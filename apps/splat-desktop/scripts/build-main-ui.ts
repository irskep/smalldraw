import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const appDir = resolve(import.meta.dir, "..");
const generatedMainUiDir = resolve(appDir, ".generated", "main-ui");
const sourceHtmlPath = resolve(appDir, "src", "main-ui", "index.html");

rmSync(generatedMainUiDir, { recursive: true, force: true });
mkdirSync(generatedMainUiDir, { recursive: true });

const result = await Bun.build({
  entrypoints: [sourceHtmlPath],
  target: "browser",
  outdir: generatedMainUiDir,
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}
