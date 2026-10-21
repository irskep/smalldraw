import "./check-bun-version";
import { $ } from "bun";

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
  await $`bun run scripts/check-bun-version.ts`;
  await $`bun run format:check`;
  await $`bunx oxlint --deny-warnings --report-unused-disable-directives scripts`;
  await $`bunx pacwich verify --strict`;
  await $`bun test scripts/check-workspaces.test.ts`;
  const base = process.argv.includes("--all") ? null : await comparisonBase();
  console.log(
    base
      ? `Checking workspaces affected since ${base} (including local edits)`
      : "Checking every workspace",
  );
  if (base) {
    await $`bunx pacwich affected list --base=${base} --explain`;
    await $`bunx pacwich affected run check --base=${base} --parallel=4`;
  } else {
    await $`bunx pacwich run check --parallel=4`;
  }
  console.log(
    `Validation completed in ${((performance.now() - started) / 1000).toFixed(1)}s`,
  );
}
