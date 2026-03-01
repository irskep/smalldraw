import type { ElectrobunRPCSchema, RPCSchema } from "electrobun";
import { Electroview } from "electrobun/view";
import "@smalldraw/splat/styles.css";
import { createKidsDrawApp } from "@smalldraw/splat";
import type {
  SavePngExportRequest,
  SavePngExportResponse,
} from "../shared/desktopRpc";

type DesktopRpcSchema = ElectrobunRPCSchema & {
  bun: RPCSchema<{
    requests: {
      savePngExport: {
        params: SavePngExportRequest;
        response: SavePngExportResponse;
      };
    };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {};
  }>;
};

const desktopRpc = Electroview.defineRPC<DesktopRpcSchema>({
  maxRequestTime: 300_000,
  handlers: {
    requests: {},
    messages: {},
  },
});

new Electroview({
  rpc: desktopRpc,
});

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container");
}

let app;
try {
  app = await createKidsDrawApp({
    container,
    savePngExport: async ({ suggestedName, blob, dataUrl }) => {
      let exportBlob = blob;
      if (!exportBlob && dataUrl) {
        exportBlob = await (await fetch(dataUrl)).blob();
      }

      if (!exportBlob || !desktopRpc.request?.savePngExport) {
        return false;
      }

      const bytes = new Uint8Array(await exportBlob.arrayBuffer());
      let binary = "";
      const chunkSize = 0x8000;
      for (let index = 0; index < bytes.length; index += chunkSize) {
        const chunk = bytes.subarray(index, index + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      try {
        const result = await desktopRpc.request.savePngExport({
          suggestedName,
          bytesBase64: btoa(binary),
        });
        return result.saved;
      } catch (error) {
        return false;
      }
    },
  });
} catch (error) {
  throw error;
}

(window as unknown as { kidsDrawApp?: typeof app }).kidsDrawApp = app;
