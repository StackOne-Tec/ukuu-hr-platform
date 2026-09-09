#!/usr/bin/env node
/**
 * Backfill redemption fields on existing Coupon documents.
 *
 * Why: before src/app/api/admin/coupons/route.ts stamped `redeemedAt` etc. as
 * explicit nulls, coupons created through the admin portal had no `redeemedAt`
 * field at all. The single-use claim in src/lib/license.ts matches
 * `where: { id, redeemedAt: null }`, and a Firestore `== null` query does NOT
 * match documents that lack the field — so every freshly created code failed
 * redemption with "already been used". This script adds the missing fields as
 * explicit nulls on unredeemed coupons so they become claimable again.
 *
 * Usage (from project root):
 *   node --env-file=.env.local --env-file=.env .zscripts/backfill-coupon-nulls.mjs
 *
 * Safe to re-run: already-redeemed coupons and coupons that already have a
 * redeemedAt field are never touched.
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function serviceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    try { return JSON.parse(inline); } catch { /* fall through */ }
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) return JSON.parse(readFileSync(path, "utf8"));
  return null;
}

function app() {
  if (getApps().length > 0) return getApp();
  const creds = serviceAccount();
  if (!creds) throw new Error("Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS first.");
  return initializeApp({ credential: cert(creds), projectId: creds.project_id });
}

async function main() {
  const fs = getFirestore(app());
  const collection = fs.collection("Coupon");
  const snap = await collection.get();
  const missing = snap.docs.filter(
    (d) => d.data().redeemedAt === undefined || d.data().redeemedAt === null
  );

  if (!missing.length) {
    console.log(`Coupon — all ${snap.size} doc(s) already have redeemedAt; nothing to do.`);
    return;
  }

  for (let i = 0; i < missing.length; i += 400) {
    const batch = fs.batch();
    for (const doc of missing.slice(i, i + 400)) {
      batch.update(doc.ref, {
        redeemedAt: null,
        redeemedByOrgId: null,
        redeemedByOrgName: null,
      });
    }
    await batch.commit();
  }
  console.log(`Coupon — stamped redemption fields on ${missing.length} unredeemed doc(s).`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});