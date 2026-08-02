/**
 * Build all publishable TypeScript packages to dist/.
 * Usage: bun run scripts/build-packages.ts
 */
import { join } from "node:path";
import { buildPackage } from "./build-package";
import { PUBLISH_ORDER } from "./publishable-packages";

const root = join(import.meta.dir, "..");

for (const pkg of PUBLISH_ORDER) {
  const cwd = join(root, pkg.dir);
  console.log(`→ building ${pkg.name}`);
  await buildPackage(cwd);
  console.log(`  ok ${pkg.dir}/dist`);
}

console.log(`\nBuilt ${PUBLISH_ORDER.length} package(s).`);
