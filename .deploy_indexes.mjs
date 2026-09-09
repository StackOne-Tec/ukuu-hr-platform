// Deploy firestore.indexes.json via the Firestore Management API (service account).
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const env = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = env.match(new RegExp(`^${k}="?(.*?)"?$`, "m"));
  return m ? m[1].trim() : "";
};
const sa = JSON.parse(readFileSync(get("GOOGLE_APPLICATION_CREDENTIALS"), "utf8"));
const spec = JSON.parse(readFileSync("firestore.indexes.json", "utf8")).indexes;

const SCOPES = "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform";
const API = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)`;

// --- mint an access token ---
function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}
const now = Math.floor(Date.now() / 1000);
const jwt = [
  b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
  b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPES, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })),
].join(".");
const signature = createSign("RSA-SHA256").update(jwt).sign(sa.private_key);
const assertion = `${jwt}.${b64url(signature)}`;

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
});
const tokenBody = await tokenRes.json();
if (!tokenRes.ok || !tokenBody.access_token) {
  console.error("TOKEN FAILED:", tokenRes.status, JSON.stringify(tokenBody).slice(0, 300));
  process.exit(1);
}
const auth = { Authorization: `Bearer ${tokenBody.access_token}` };
console.log("[token] ok");

// --- list existing indexes ---
const listRes = await fetch(`${API}/collectionGroups/-/indexes`, { headers: auth });
if (!listRes.ok) {
  console.error("LIST FAILED:", listRes.status, (await listRes.text()).slice(0, 300));
  process.exit(1);
}
const existing = (await listRes.json()).indexes ?? [];
console.log("[list] existing indexes:", existing.length);

const norm = (fields) =>
  fields
    .filter((f) => f.fieldPath !== "__name__")
    .map((f) => `${f.fieldPath}:${f.order === "DESCENDING" ? "desc" : "asc"}`)
    .join(",");
const have = new Set(existing.map((i) => `${i.collectionGroup ?? i.parent?.split("collectionGroups/")[1]?.split("/")[0] ?? ""}|${norm(i.fields ?? [])}`));

// collectionGroup from index name: .../collectionGroups/<name>/indexes/<id>
const colOf = (i) => {
  const m = i.name?.match(/collectionGroups\/([^/]+)\/indexes\//);
  return m ? decodeURIComponent(m[1]) : "";
};

let created = 0;
let skipped = 0;
for (const idx of spec) {
  const key = `${idx.collectionGroup}|${norm(idx.fields)}`;
  if (have.has(key)) {
    skipped++;
    continue;
  }
  const body = { queryScope: idx.queryScope ?? "COLLECTION", fields: idx.fields.map((f) => ({ fieldPath: f.fieldPath, order: f.order })) };
  const res = await fetch(`${API}/collectionGroups/${encodeURIComponent(idx.collectionGroup)}/indexes`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    created++;
    console.log(`[create] ${idx.collectionGroup} (${norm(idx.fields)}) → ${(await res.json()).name?.split("/").pop()}`);
  } else {
    const text = await res.text();
    if (text.includes("already exists") || res.status === 409) {
      skipped++;
      console.log(`[exists] ${idx.collectionGroup} (${norm(idx.fields)})`);
    } else {
      console.error(`[FAIL] ${idx.collectionGroup} (${norm(idx.fields)}) ${res.status}: ${text.slice(0, 200)}`);
    }
  }
}
console.log(`[done] created=${created} already=${skipped} total=${spec.length}`);

// --- poll until ready (indexes build asynchronously, ~1-5 min) ---
const deadline = Date.now() + 5 * 60 * 1000;
let pending = created;
while (pending > 0 && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 8000));
  const res = await fetch(`${API}/collectionGroups/-/indexes`, { headers: auth });
  const list = ((await res.json()).indexes ?? []).filter((i) => i.state !== "READY");
  pending = list.length;
  console.log(`[poll] indexes still building: ${pending}`);
}
console.log(pending === 0 ? "[ready] all indexes READY" : "[warn] still building (they finish server-side)");