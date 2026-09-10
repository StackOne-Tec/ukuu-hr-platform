import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const outputDir = process.env.NEXT_PUBLIC_PLATFORM === "admin" ? ".next-admin" : ".next";

function findServer(directory) {
  const direct = path.join(directory, "server.js");
  if (fs.existsSync(direct)) return direct;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    const nested = findServer(path.join(directory, entry.name));
    if (nested) return nested;
  }
  return null;
}

const server = findServer(path.join(outputDir, "standalone"));
if (!server) throw new Error(`Could not find server.js under ${outputDir}/standalone`);

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
