import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Splatterboard",
    identifier: "dev.smalldraw.splatterboard",
    version: "0.0.1",
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
      external: [],
    },
    views: {},
    copy: {
      ".generated/main-ui/": "views/main-ui/",
    },
  },
} satisfies ElectrobunConfig;
