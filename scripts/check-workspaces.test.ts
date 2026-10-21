import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { $ } from "bun";

import { comparisonBase } from "./check-workspaces";

const directories: string[] = [];
const root = fileURLToPath(new URL("../", import.meta.url));
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

test("affected selection includes dependents and shared tooling, but isolates server and docs edits", async () => {
  const affected = async (file: string): Promise<string[]> =>
    JSON.parse(
      await $`bunx pacwich affected list --files=${file} --json`
        .cwd(root)
        .quiet()
        .text(),
    );
  expect(await affected("apps/server/src/index.ts")).toEqual(["server"]);
  expect(await affected("docs/index.md")).toEqual(["docs-site"]);
  const geometry = await affected("packages/geometry/src/index.ts");
  for (const name of [
    "@smalldraw/geometry",
    "@smalldraw/renderer-canvas",
    "@smalldraw/splat",
    "splat-web",
    "automerge-jumpstart",
  ]) {
    expect(geometry).toContain(name);
  }
  expect(geometry).not.toContain("server");
  for (const file of [
    ".bun-version",
    "bun.lock",
    "mise.toml",
    "scripts/automerge-asset.mts",
    "patches/example.patch",
  ]) {
    expect(await affected(file)).toHaveLength(14);
  }
});

test("main, feature branches, detached commits, and missing history choose safe bases", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pacwich-base-"));
  directories.push(dir);
  const git = (...args: string[]) => $`git -C ${dir} ${args}`.quiet();
  await git("init", "-b", "main");
  await git("config", "user.email", "test@example.invalid");
  await git("config", "user.name", "Test");
  await git("config", "core.hooksPath", "/dev/null");
  await git("commit", "--allow-empty", "-m", "initial");
  expect(await comparisonBase(dir)).toBeNull();
  await git("commit", "--allow-empty", "-m", "main change");
  expect(await comparisonBase(dir)).toBe("HEAD^");
  await git("checkout", "--detach");
  expect(await comparisonBase(dir)).toBe("HEAD^");
  await git("checkout", "-b", "feature");
  expect(await comparisonBase(dir)).toBe("main");
  await git("commit", "--allow-empty", "-m", "feature change");
  await git("checkout", "--detach");
  expect(await comparisonBase(dir)).toBe("main");
  await git("update-ref", "refs/remotes/origin/main", "main");
  await git("branch", "-D", "main");
  expect(await comparisonBase(dir)).toBe("origin/main");
  await git("update-ref", "-d", "refs/remotes/origin/main");
  expect(await comparisonBase(dir)).toBeNull();
});
