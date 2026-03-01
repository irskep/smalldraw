import { existsSync, lstatSync, symlinkSync } from "node:fs";
import { resolve } from "node:path";

const appDir = resolve(import.meta.dir, "..");
const rootNodeModulesDir = resolve(appDir, "..", "..", "node_modules");
const localNodeModulesDir = resolve(appDir, "node_modules");
if (!existsSync(localNodeModulesDir)) {
  symlinkSync(rootNodeModulesDir, localNodeModulesDir, "dir");
}

if (!lstatSync(localNodeModulesDir).isSymbolicLink()) {
  throw new Error(
    `Expected ${localNodeModulesDir} to be a symlink to the workspace node_modules`,
  );
}

const electrobunBinary = resolve(localNodeModulesDir, ".bin", "electrobun");
const args = Bun.argv.slice(2);
if (args.length === 0) {
  throw new Error("Expected electrobun command arguments");
}

if (args[0] === "build") {
  const compileResult = Bun.spawnSync(
    [process.execPath, "run", resolve(appDir, "scripts", "build-main-ui.ts")],
    {
      cwd: appDir,
      stdio: ["inherit", "inherit", "inherit"],
      env: process.env,
    },
  );

  if (compileResult.exitCode !== 0) {
    process.exit(compileResult.exitCode);
  }
}

const result = Bun.spawnSync([electrobunBinary, ...args], {
  cwd: appDir,
  stdio: ["inherit", "inherit", "inherit"],
  env: process.env,
});

if (result.exitCode !== 0) {
  process.exit(result.exitCode);
}
