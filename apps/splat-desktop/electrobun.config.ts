import type { ElectrobunConfig } from "electrobun";

const canCodesign = Boolean(process.env.ELECTROBUN_DEVELOPER_ID);
const canNotarize =
  canCodesign &&
  Boolean(process.env.ELECTROBUN_TEAMID) &&
  Boolean(process.env.ELECTROBUN_APPLEID) &&
  Boolean(process.env.ELECTROBUN_APPLEIDPASS);

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
    mac: {
      codesign: canCodesign,
      notarize: canNotarize,
    },
    views: {},
    copy: {
      ".generated/main-ui/": "views/main-ui/",
    },
  },
} satisfies ElectrobunConfig;
