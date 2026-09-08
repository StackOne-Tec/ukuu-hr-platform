import { runCleanup } from "./runner";

export default async function globalTeardown() {
  await runCleanup();
}
