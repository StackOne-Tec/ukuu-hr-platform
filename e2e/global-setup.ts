import { runCleanup } from "./runner";

/** Clear leftovers from crashed runs of this suite before starting. */
export default async function () {
  await runCleanup();
}
