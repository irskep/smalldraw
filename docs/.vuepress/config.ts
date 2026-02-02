import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { viteBundler } from "@vuepress/bundler-vite";
import { copyCodePlugin } from "@vuepress/plugin-copy-code";
import { markdownChartPlugin } from "@vuepress/plugin-markdown-chart";
import type {
  SidebarArrayOptions,
  SidebarItemOptions,
} from "@vuepress/theme-default";
import { defaultTheme } from "@vuepress/theme-default";
import { defineUserConfig } from "vuepress";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(__dirname, "..");

const toTitle = (name: string) =>
  name.replace(/[-_]/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());

const toPosixPath = (value: string) => value.split(path.sep).join("/");

const fileToLink = (filePath: string) => {
  const rel = toPosixPath(path.relative(docsDir, filePath));
  if (rel === "index.md") {
    return "/";
  }

  if (rel.endsWith("/README.md")) {
    return `/${rel.replace(/\/README\.md$/, "")}/`;
  }

  return `/${rel.replace(/\.md$/, "")}`;
};

const excludedDirs = new Set([".vuepress"]);

const buildSidebarDir = (
  dir: string,
  relDir: string,
): SidebarItemOptions | null => {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !excludedDirs.has(entry.name));

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const children: SidebarArrayOptions = [];

  for (const fileName of files) {
    if (fileName === "README.md") {
      continue;
    }

    if (relDir === "" && fileName === "index.md") {
      continue;
    }

    const filePath = path.join(dir, fileName);
    const baseName = fileName.replace(/\.md$/, "");
    children.push({
      text: toTitle(baseName),
      link: fileToLink(filePath),
    });
  }

  for (const folderName of directories) {
    const folderPath = path.join(dir, folderName);
    const childRelDir = relDir === "" ? folderName : `${relDir}/${folderName}`;
    const childItem = buildSidebarDir(folderPath, childRelDir);
    if (childItem) {
      children.push(childItem);
    }
  }

  const hasReadme = files.includes("README.md");
  const label = relDir === "" ? "Docs" : toTitle(path.basename(relDir));

  if (relDir === "") {
    return {
      text: label,
      children,
      collapsible: false,
    };
  }

  if (children.length === 0) {
    if (!hasReadme) {
      return null;
    }

    return {
      text: label,
      link: `/${relDir}/`,
    };
  }

  return {
    text: label,
    link: hasReadme ? `/${relDir}/` : undefined,
    children,
    collapsible: true,
  };
};

const generateSidebar = (): SidebarArrayOptions => {
  const rootItem = buildSidebarDir(docsDir, "");
  if (!rootItem) {
    return [];
  }

  if (rootItem && typeof rootItem === "object" && "children" in rootItem) {
    return rootItem.children ?? [];
  }

  return [];
};

const generateNavbar = (): { text: string; link: string }[] => {
  const entries = fs
    .readdirSync(docsDir, { withFileTypes: true })
    .filter((entry) => !excludedDirs.has(entry.name));

  const items: { text: string; link: string }[] = [
    { text: "Home", link: "/" },
    { text: "API", link: "/api.md" },
  ];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dirPath = path.join(docsDir, entry.name);
    const readmePath = path.join(dirPath, "README.md");
    if (!fs.existsSync(readmePath)) {
      continue;
    }

    items.push({
      text: toTitle(entry.name),
      link: `/${entry.name}/`,
    });
  }

  return items;
};

export default defineUserConfig({
  bundler: viteBundler(),
  theme: defaultTheme({
    navbar: generateNavbar(),
    sidebar: generateSidebar(),
  }),
  lang: "en-US",
  title: "SmallDraw",
  description: "SmallDraw Documentation",
  plugins: [
    copyCodePlugin({
      showInMobile: true,
    }),
    markdownChartPlugin({
      mermaid: true,
    }),
  ],
});
