import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runTestStep } from "./test-output";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

test("successful test output stays in the log; failures retain diagnostics and exit status", async () => {
  const logDirectory = await mkdtemp(join(tmpdir(), "test-output-"));
  directories.push(logDirectory);
  const stdout = spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = spyOn(process.stderr, "write").mockImplementation(() => true);
  const report = spyOn(console, "log").mockImplementation(() => {});
  try {
    expect(
      await runTestStep(
        "success",
        [
          "bun",
          "-e",
          'console.log("debug success"); console.error("stderr success")',
        ],
        { logDirectory },
      ),
    ).toBe(0);
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
    expect(await Bun.file(join(logDirectory, "success.log")).text()).toContain(
      "debug success",
    );
    expect(await Bun.file(join(logDirectory, "success.log")).text()).toContain(
      "stderr success",
    );
    expect(
      await runTestStep(
        "failure",
        [
          "bun",
          "-e",
          'console.log("debug failure"); console.error("assertion failed"); process.exit(7)',
        ],
        { logDirectory },
      ),
    ).toBe(7);
    expect(String(stdout.mock.calls[0]?.[0])).toContain("debug failure");
    expect(String(stderr.mock.calls[0]?.[0])).toContain("assertion failed");
    expect(await Bun.file(join(logDirectory, "failure.log")).text()).toContain(
      "assertion failed",
    );
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
    report.mockRestore();
  }
});
