import { viteBundler } from "@vuepress/bundler-vite";
import { defaultTheme } from "@vuepress/theme-default";
import { defineUserConfig } from "vuepress";
import { copyCodePlugin } from "@vuepress/plugin-copy-code";
import { markdownChartPlugin } from "@vuepress/plugin-markdown-chart";

export default defineUserConfig({
  bundler: viteBundler(),
  theme: defaultTheme({
    navbar: [
      { text: "Home", link: "/" },
      { text: "Guides", link: "/guides/" },
      { text: "Explanation", link: "/explanation/" },
      { text: "API", link: "/api/" },
    ],
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
