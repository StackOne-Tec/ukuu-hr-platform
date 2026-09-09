import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const env = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = env.match(new RegExp(`^${k}="?(.*?)"?$`, "m"));
  return m ? m[1].trim() : "";
};
const sa = JSON.parse(readFileSync(get("GOOGLE_APPLICATION_CREDENTIALS"), "utf8"));
const spec = JSON.parse(readFileSync("firestore.indexes.json", "utf8")).indexes;

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}
const now = Math.floor(Date.now() / 1000);
const jwt = [
  b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
  b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })),
].join(".");
const signature = createSign("RSA-SHA256").update(jwt).sign(sa.private_key);
const assertion = `${jwt}.${b64url(signature)}`;
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
});
const { access_token } = await tokenRes.json();

const API = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)`;
const res = await fetch(`${API}/collectionGroups/-/indexes`, { headers: { Authorization: `Bearer ${access_token}` } });
const { indexes = [] } = await res.json();

const norm = (fields) =>
  fields
    .filter((f) => f.fieldPath !== "__name__")
    .map((f) => `${f.fieldPath}:${f.order === "DESCENDING" ? "desc" : "asc"}`)
    .join(",");
const colOf = (i) => {
  const m = i.name?.match(/collectionGroups\/([^/]+)\/indexes\//);
  return m ? decodeURIComponent(m[1]) : "?";
};

console.log("=== existing ===");
for (const i of indexes) {
  console.log(`- ${colOf(i)} (${norm(i.fields)}) [${i.state}]`);
}
console.log("\n=== from firestore.indexes.json, missing? ===");
const have = new Set(indexes.map((i) => `${colOf(i)}|${norm(i.fields)}`));
let missing = 0;
for (const idx of spec) {
  const key = `${idx.collectionGroup}|${norm(idx.fields)}`;
  if (have.has(key)) console.log(`✓ has   ${idx.collectionGroup} (${norm(idx.fields)})`);
  else {
    missing++;
    console.log(`✗ MISSING ${idx.collectionGroup} (${norm(idx.fields)})`);
  }
}
console.log(`\nmissing: ${missing} of ${spec.length}`);