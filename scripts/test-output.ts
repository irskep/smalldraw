import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { $ } from "bun";

// Keep successful runs concise without throwing away their debugging output.
export async function runTestStep(
  name: string,
  command: string[],
  {
    verbose = false,
    logDirectory = process.env.LOCALCI_TASK_OUTPUT_DIR ?? ".cache/tests",
  } = {},
): Promise<number> {
  const started = performance.now();
  console.log(`Running ${name} tests…`);
  const task = $`${command}`.nothrow();
  const result = await (verbose ? task : task.quiet());
  await mkdir(logDirectory, { recursive: true });
  const log = join(logDirectory, `${name}.log`);
  await Bun.write(log, Buffer.concat([result.stdout, result.stderr]));
  if (result.exitCode !== 0 && !verbose) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  }
  console.log(
    `${name}: ${result.exitCode === 0 ? "passed" : "FAILED"} (${((performance.now() - started) / 1000).toFixed(1)}s); log: ${log}`,
  );
  return result.exitCode;
}
