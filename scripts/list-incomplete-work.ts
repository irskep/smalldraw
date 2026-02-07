import { YAML } from "bun";

const glob = new Bun.Glob("work/**/??-*.yaml");
const entries: { path: string; status: string; summary: string }[] = [];

for (const path of glob.scanSync({ onlyFiles: true })) {
  const text = await Bun.file(path).text();
  const data = YAML.parse(text) as { status?: string; summary?: string } | null;
  const status = data?.status?.trim() ?? "";
  if (status === "complete") continue;
  const summary = data?.summary?.trim() ?? "";
  entries.push({ path, status, summary });
}

entries.sort((a, b) => a.path.localeCompare(b.path));

for (const entry of entries) {
  const suffix = entry.summary ? ` - ${entry.summary}` : "";
  const status = entry.status ? ` [${entry.status}]` : "";
  console.log(`${entry.path}${status}${suffix}`);
}
