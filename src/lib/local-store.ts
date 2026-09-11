import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/* ═══════════════════════════════════════════════════════════════════════════
   Local document store — zero-dependency fallback when Firebase is not
   configured on the deployment.

   Mirrors the Firestore document semantics the app's data layer (db.ts)
   relies on: collections of JSON documents addressed by string id, with
   create-fails-if-exists, update/merge, delete and full-table scans for
   queries.

   Persistence: a single JSON file on disk, loaded lazily into memory on
   first access and rewritten atomically (tmp file + rename) after every
   mutation via a serialized write queue. Pure `node:fs` — no native
   dependencies, no Prisma — so it runs anywhere the app runs (local dev,
   Docker, Render, this sandbox). Configure the location with
   UKUU_LOCAL_STORE_DIR (defaults to `<cwd>/.data`).

   NOTE: on hosts with an ephemeral disk the file resets on redeploy — the
   app still works fully (accounts, sessions, data) for the service's
   lifetime. Configure a real Firebase service account to get durable
   Cloud Firestore storage; this store then goes completely idle.
   ═══════════════════════════════════════════════════════════════════════════ */

export type LocalRow = Record<string, any>;

type StoreShape = Record<string, Record<string, LocalRow>>;

/* ─── in-memory state ─────────────────────────────────────────────────────── */

let store: StoreShape = {};
let loaded = false;
let loadPromise: Promise<void> | null = null;
let lastSync = 0; // epoch ms of the last load/flush we know the file reflects

function storeDir(): string {
  return process.env.UKUU_LOCAL_STORE_DIR || path.join(process.cwd(), ".data");
}

function storeFile(): string {
  return path.join(storeDir(), "ukuu-local-store.json");
}

async function load(): Promise<void> {
  if (loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await fsp.readFile(storeFile(), "utf8");
      store = JSON.parse(raw) as StoreShape;
      const st = await fsp.stat(storeFile());
      lastSync = st.mtimeMs;
    } catch {
      store = {}; // first boot or unreadable file — start fresh
    }
    loaded = true;
  })();
  return loadPromise;
}

/** Re-read the store file when another process (or a dev-server module
    instance re-created by HMR) has written it since our last sync. Keeps
    every caller consistent no matter which instance served the last write. */
async function maybeReload(): Promise<void> {
  await load();
  try {
    const st = await fsp.stat(storeFile());
    if (st.mtimeMs > lastSync) {
      store = JSON.parse(await fsp.readFile(storeFile(), "utf8")) as StoreShape;
      lastSync = st.mtimeMs;
    }
  } catch {
    /* unreadable/missing — keep in-memory state */
  }
}

/* Serialized write queue: mutations are applied to memory synchronously by
   callers, then the whole store is flushed to disk one write at a time. */
let writeChain: Promise<void> = Promise.resolve();

function scheduleFlush(): Promise<void> {
  writeChain = writeChain.then(async () => {
    try {
      await fsp.mkdir(storeDir(), { recursive: true });
      const tmp = `${storeFile()}.${crypto.randomBytes(4).toString("hex")}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(store), "utf8");
      await fsp.rename(tmp, storeFile());
      const st = await fsp.stat(storeFile());
      lastSync = st.mtimeMs;
    } catch (e) {
      // Never let persistence failures break a request — memory stays
      // authoritative for the running process.
      console.warn("[local-store] flush failed:", e instanceof Error ? e.message : e);
    }
  });
  return writeChain;
}

function collection(name: string): Record<string, LocalRow> {
  if (!store[name]) store[name] = {};
  return store[name];
}

/* ─── document operations ─────────────────────────────────────────────────── */

export async function localGet(collectionName: string, id: string): Promise<LocalRow | null> {
  await maybeReload();
  return collection(collectionName)[id] ?? null;
}

export async function localAll(collectionName: string): Promise<LocalRow[]> {
  await maybeReload();
  return Object.values(collection(collectionName));
}

/** Create (fails when the id already exists — matches Firestore/Postgres semantics). */
export async function localCreate(collectionName: string, row: LocalRow): Promise<LocalRow> {
  await maybeReload();
  const col = collection(collectionName);
  const id = String(row.id);
  if (col[id]) {
    throw new Error(`ALREADY_EXISTS: ${collectionName}/${id} already exists.`);
  }
  col[id] = row;
  await scheduleFlush();
  return row;
}

/** Create-or-replace. */
export async function localSet(collectionName: string, row: LocalRow): Promise<void> {
  await maybeReload();
  collection(collectionName)[String(row.id)] = row;
  await scheduleFlush();
}

/** Merge fields into an existing row (Firestore `update()` semantics). */
export async function localMerge(collectionName: string, id: string, patch: LocalRow): Promise<void> {
  await maybeReload();
  const col = collection(collectionName);
  if (!col[id]) {
    throw new Error(`NOT_FOUND: ${collectionName}/${id} does not exist.`);
  }
  col[id] = { ...col[id], ...patch };
  await scheduleFlush();
}

export async function localDelete(collectionName: string, id: string): Promise<void> {
  await maybeReload();
  const col = collection(collectionName);
  if (col[id]) {
    delete col[id];
    await scheduleFlush();
  }
}

/** Cheap connectivity probe for the health endpoint. */
export async function localHealthy(): Promise<boolean> {
  try {
    await maybeReload();
    await scheduleFlush();
    return true;
  } catch {
    return false;
  }
}

/* ─── local credentials (auth fallback) ──────────────────────────────────── */

export type LocalCredential = {
  uid: string;
  email: string;
  passwordHash: string; // scrypt: "salt:hash" (hex)
  emailVerified: boolean;
};

function credCollection(): Record<string, LocalCredential> {
  // Stored in the same JSON file under the "_credentials" collection.
  return collection("_credentials") as Record<string, LocalCredential>;
}

export async function localCredentialGet(email: string): Promise<LocalCredential | null> {
  await maybeReload();
  return credCollection()[email] ?? null;
}

export async function localCredentialUpsert(
  email: string,
  passwordHash: string,
  uid?: string
): Promise<LocalCredential> {
  await maybeReload();
  const creds = credCollection();
  const existing = creds[email];
  if (existing) {
    existing.passwordHash = passwordHash;
    creds[email] = existing;
  } else {
    creds[email] = {
      uid: uid ?? `local_${crypto.randomBytes(12).toString("hex")}`,
      email,
      passwordHash,
      emailVerified: true, // no verification email infra in local mode
    };
  }
  await scheduleFlush();
  return creds[email];
}

export async function localCredentialDeleteByUid(uid: string): Promise<void> {
  await maybeReload();
  const creds = credCollection();
  const email = Object.keys(creds).find((e) => creds[e].uid === uid);
  if (email) {
    delete creds[email];
    await scheduleFlush();
  }
}

/* ─── password hashing (scrypt, constant-time compare) ───────────────────── */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}
