import fs from "node:fs";
import path from "node:path";

const outputDir = process.env.NEXT_PUBLIC_PLATFORM === "admin" ? ".next-admin" : ".next";
const standaloneDir = path.join(outputDir, "standalone");

function findServerRoot(directory) {
  const direct = path.join(directory, "server.js");
  if (fs.existsSync(direct)) return directory;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    const nested = path.join(directory, entry.name);
    const serverRoot = findServerRoot(nested);
    if (serverRoot) return serverRoot;
  }
  return null;
}

function replaceDirectory(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

function copyDirectoryContents(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    fs.cpSync(path.join(source, entry.name), path.join(destination, entry.name), {
      recursive: true,
      force: true,
    });
  }
}

const serverRoot = findServerRoot(standaloneDir);
if (!serverRoot) {
  throw new Error(`Could not find server.js under ${standaloneDir}`);
}

// Next may place the standalone server in a nested project directory when it
// infers a workspace root. Copy assets relative to the actual server root;
// that is the directory Next changes into at startup.
replaceDirectory(
  path.join(outputDir, "static"),
  path.join(serverRoot, outputDir, "static")
);
replaceDirectory("public", path.join(serverRoot, "public"));

// Safety net: when the build used a non-default dist dir (the admin portal's
// .next-admin), also mirror the static assets into .next/static. Some Render
// services still run a hardcoded `cp -r .next/static ...` step after the
// build; keeping .next/static present makes that step a harmless no-op instead
// of failing the deploy with "cp: cannot stat '.next/static'".
if (outputDir !== ".next") {
  replaceDirectory(path.join(outputDir, "static"), path.join(".next", "static"));
}

// Some existing Render services still start `node .next/standalone/server.js`.
// Flatten the generated server into that path for either portal so an old
// service command remains valid during the transition to `npm start`.
const legacyDir = path.join(".next", "standalone");
if (serverRoot !== legacyDir) {
  const sourceIsNested = path.resolve(serverRoot).startsWith(`${path.resolve(legacyDir)}${path.sep}`);
  if (!sourceIsNested) fs.rmSync(legacyDir, { recursive: true, force: true });
  copyDirectoryContents(serverRoot, legacyDir);
}

console.log(`Prepared standalone server from ${outputDir}/standalone (${serverRoot})`);
