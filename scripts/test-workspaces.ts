import "./check-bun-version";
import { $ } from "bun";

import { runTestStep } from "./test-output";

// localci checks out detached commits. A commit on main's history still uses
// its parent; detached feature commits compare with main, like named branches.
export async function comparisonBase(
  cwd = process.cwd(),
): Promise<string | null> {
  const git = (...args: string[]) => $`git -C ${cwd} ${args}`.quiet().nothrow();
  const branch = (await git("symbolic-ref", "--short", "HEAD")).text().trim();
  const main =
    (await git("rev-parse", "--verify", "main")).exitCode === 0
      ? "main"
      : "origin/main";
  const onMain =
    branch === "main" ||
    (!branch &&
      (await git("merge-base", "--is-ancestor", "HEAD", main)).exitCode === 0);
  const base = onMain ? "HEAD^" : main;
  return (await git("rev-parse", "--verify", base)).exitCode === 0
    ? base
    : null;
}

if (import.meta.main) {
  const started = performance.now();
  const verbose = process.argv.includes("--verbose");
  const base = process.argv.includes("--all") ? null : await comparisonBase();
  console.log(
    base
      ? `Testing workspaces affected since ${base} (including local edits)`
      : "Testing every workspace",
  );
  const pacwich = ["bunx", "pacwich", ...(base ? ["affected"] : []), "run"];
  const options = [
    ...(base ? [`--base=${base}`] : []),
    "--parallel=4",
    "--output-style=prefixed",
  ];
  const steps: [string, string[]][] = [
    [
      "runner",
      [
        "bun",
        "test",
        "scripts/test-workspaces.test.ts",
        "scripts/test-output.test.ts",
      ],
    ],
    ["workspaces", [...pacwich, "test", ...options]],
    ["browser", [...pacwich, "test:ui:managed", ...options]],
  ];
  for (const [name, command] of steps) {
    const code = await runTestStep(name, command, { verbose });
    if (code !== 0) process.exit(code);
  }
  console.log(
    `Tests completed in ${((performance.now() - started) / 1000).toFixed(1)}s`,
  );
}
