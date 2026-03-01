import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";

const appDir = resolve(import.meta.dir, "..");
const rootNodeModulesDir = resolve(appDir, "..", "..", "node_modules");
const localNodeModulesDir = resolve(appDir, "node_modules");

const hasPathEntry = (path: string): boolean => {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
};

if (!hasPathEntry(localNodeModulesDir)) {
  mkdirSync(localNodeModulesDir, { recursive: true });
} else {
  const localNodeModulesStat = lstatSync(localNodeModulesDir);
  if (
    localNodeModulesStat.isSymbolicLink() &&
    !existsSync(localNodeModulesDir)
  ) {
    unlinkSync(localNodeModulesDir);
    mkdirSync(localNodeModulesDir, { recursive: true });
  }
}

const localElectrobunPackageDir = resolve(localNodeModulesDir, "electrobun");
const rootElectrobunPackageDir = resolve(rootNodeModulesDir, "electrobun");
if (!hasPathEntry(localElectrobunPackageDir)) {
  symlinkSync(
    rootElectrobunPackageDir,
    localElectrobunPackageDir,
    process.platform === "win32" ? "junction" : "dir",
  );
}

const localBinDir = resolve(localNodeModulesDir, ".bin");
if (!hasPathEntry(localBinDir)) {
  mkdirSync(localBinDir, { recursive: true });
}

const localElectrobunBinary = resolve(
  localNodeModulesDir,
  ".bin",
  "electrobun",
);
const rootElectrobunBinary = resolve(rootNodeModulesDir, ".bin", "electrobun");
if (!hasPathEntry(localElectrobunBinary)) {
  if (process.platform === "win32") {
    copyFileSync(rootElectrobunBinary, localElectrobunBinary);
  } else {
    symlinkSync(rootElectrobunBinary, localElectrobunBinary);
  }
}

const electrobunBinary = localElectrobunBinary;

if (!existsSync(electrobunBinary)) {
  throw new Error(`Could not find electrobun binary at ${electrobunBinary}`);
}
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
