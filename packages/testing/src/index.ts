import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import looksSame from "looks-same";

export interface SnapshotOptions {
  snapshotDir?: string;
  updateEnvVar?: string;
  testCommand?: string;
  tolerance?: number;
}

export function resolveSnapshotDir(
  fromUrl: string,
  relativeDir: string = "../../__snapshots__",
): string {
  const filename = fileURLToPath(fromUrl);
  const dirname = path.dirname(filename);
  return path.resolve(dirname, relativeDir);
}

export async function expectSnapshot(
  buffer: Buffer,
  snapshotName: string,
  options: SnapshotOptions = {},
): Promise<void> {
  const snapshotDir =
    options.snapshotDir ??
    resolveSnapshotDir(import.meta.url, "../../__snapshots__");
  const updateEnvVar = options.updateEnvVar ?? "UPDATE_SNAPSHOTS";
  const tolerance = options.tolerance ?? 2;
  const shouldUpdate = process.env[updateEnvVar] === "1";

  await fs.mkdir(snapshotDir, { recursive: true });
  const snapshotPath = path.resolve(snapshotDir, `${snapshotName}.png`);
  let expected: Buffer;
  try {
    expected = await fs.readFile(snapshotPath);
  } catch (error: unknown) {
    if (isNodeErrorWithCode(error) && error.code === "ENOENT") {
      await fs.writeFile(snapshotPath, buffer);
      if (shouldUpdate) {
        return;
      }
      throw new Error(
        `Snapshot '${snapshotName}' did not exist. A new baseline was created at ${path.relative(
          process.cwd(),
          snapshotPath,
        )}. Verify it manually and rerun tests${formatUpdateMessage(
          options.testCommand,
          updateEnvVar,
        )}.`,
      );
    }
    throw error;
  }
  const match = await imagesMatch(buffer, expected, tolerance);
  if (match) {
    return;
  }
  if (shouldUpdate) {
    await fs.writeFile(snapshotPath, buffer);
    return;
  }
  const diffPath = path.resolve(snapshotDir, `${snapshotName}.diff.png`);
  await createDiff(buffer, expected, diffPath, tolerance);
  throw new Error(
    `Snapshot mismatch for '${snapshotName}'. See diff at ${path.relative(
      process.cwd(),
      diffPath,
    )}.${formatUpdateMessage(options.testCommand, updateEnvVar)}`,
  );
}

export function imagesMatch(
  actual: Buffer,
  expected: Buffer,
  tolerance = 2,
): Promise<boolean> {
  if (actual === expected) {
    return Promise.resolve(true);
  }
  return new Promise((resolve, reject) => {
    looksSame(actual, expected, { tolerance }, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Boolean(result?.equal));
    });
  });
}

function createDiff(
  actual: Buffer,
  expected: Buffer,
  diffPath: string,
  tolerance: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    looksSame.createDiff(
      {
        reference: expected,
        current: actual,
        diff: diffPath,
        highlightColor: "#ff00ff",
        tolerance,
      },
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      },
    );
  });
}

function formatUpdateMessage(
  testCommand?: string,
  updateEnvVar: string = "UPDATE_SNAPSHOTS",
): string {
  if (!testCommand) {
    return ` (or run with ${updateEnvVar}=1 to accept automatically)`;
  }
  return ` Run ${updateEnvVar}=1 ${testCommand} to accept changes.`;
}

function isNodeErrorWithCode(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

export * from "./geometry";
