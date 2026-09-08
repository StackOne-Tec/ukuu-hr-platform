#!/usr/bin/env node
/**
 * Generate src/lib/schema-ddl.ts from scripts/schema.sql so the DDL can be
 * bundled into the standalone server (files under scripts/ are not traced at
 * runtime). scripts/schema.sql remains the single source of truth — edit it
 * there, then re-run:  node scripts/generate-schema-ddl.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const sql = readFileSync("/home/z/my-project/scripts/schema.sql", "utf8");

if (sql.includes("`") || sql.includes("${")) {
  console.error("schema.sql contains backticks or ${ — needs manual escaping before embedding");
  process.exit(1);
}

const out = `// GENERATED from scripts/schema.sql — do not edit by hand.
// Regenerate with: node scripts/generate-schema-ddl.mjs
// Bundled so src/instrumentation.ts can bootstrap a brand-new database at
// server boot (every statement is idempotent: IF NOT EXISTS / guarded DO blocks).
export const SCHEMA_DDL = \`${sql}\`;
`;

writeFileSync("/home/z/my-project/src/lib/schema-ddl.ts", out);
console.log("wrote src/lib/schema-ddl.ts (" + sql.length + " chars of DDL)");
