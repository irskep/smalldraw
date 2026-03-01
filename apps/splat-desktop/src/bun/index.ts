import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ElectrobunEvent,
  ElectrobunRPCSchema,
  RPCSchema,
} from "electrobun";
import {
  ApplicationMenu,
  type ApplicationMenuItemConfig,
  BrowserView,
  BrowserWindow,
  Utils,
} from "electrobun/bun";
import type {
  SavePngExportRequest,
  SavePngExportResponse,
} from "../shared/desktopRpc";

type EmptyRpcMap = Record<string, never>;

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
    requests: EmptyRpcMap;
    messages: EmptyRpcMap;
  }>;
};

const runAppCommand = (
  windowRef: BrowserWindow,
  command: "undo" | "redo" | "clear" | "export" | "newDrawing" | "browse",
): void => {
  windowRef.webview.executeJavascript(
    `window.kidsDrawApp?.commands?.${command}?.()`,
  );
};

ApplicationMenu.setApplicationMenu([
  {
    label: "Splatterboard",
    submenu: [
      {
        role: "hide",
        accelerator: "cmd+h",
      },
      {
        role: "hideOthers",
        accelerator: "cmd+alt+h",
      },
      { role: "showAll" },
      { type: "separator" },
      {
        role: "quit",
        accelerator: "cmd+q",
      },
    ],
  },
  {
    label: "File",
    submenu: [
      {
        label: "New Drawing",
        action: "file.newDrawing",
        accelerator: "cmd+n",
      },
      {
        label: "Browse Drawings",
        action: "file.browse",
        accelerator: "cmd+o",
      },
      { type: "separator" },
      {
        label: "Export",
        action: "file.export",
        accelerator: "cmd+e",
      },
      {
        label: "Clear Canvas",
        action: "file.clear",
        accelerator: "cmd+shift+k",
      },
      { type: "separator" },
      { role: "close" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      {
        label: "Undo",
        action: "edit.undo",
        accelerator: "cmd+z",
      },
      {
        label: "Redo",
        action: "edit.redo",
        accelerator: "cmd+shift+z",
      },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "delete" },
      { role: "selectAll" },
    ],
  },
  {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      { type: "separator" },
      { role: "bringAllToFront" },
    ],
  },
] satisfies ApplicationMenuItemConfig[]);

const desktopRpc = BrowserView.defineRPC<DesktopRpcSchema>({
  maxRequestTime: 300_000,
  handlers: {
    requests: {
      savePngExport: async ({
        suggestedName,
        bytesBase64,
      }: SavePngExportRequest): Promise<SavePngExportResponse> => {
        const [targetDirectory] = await Utils.openFileDialog({
          startingFolder: process.env.HOME || "~/",
          allowedFileTypes: "*",
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });

        if (!targetDirectory) {
          return { saved: false };
        }

        const targetPath = join(targetDirectory, suggestedName);
        writeFileSync(targetPath, Buffer.from(bytesBase64, "base64"));
        return {
          saved: true,
          path: targetPath,
        };
      },
    } as never,
    messages: {},
  },
});

const windowRef = new BrowserWindow({
  title: "Splatterboard",
  url: "views://main-ui/index.html",
  rpc: desktopRpc,
  frame: {
    width: 1280,
    height: 900,
    x: 120,
    y: 120,
  },
});

ApplicationMenu.on("application-menu-clicked", (event) => {
  const menuEvent = event as ElectrobunEvent<
    { id: number; action: string },
    never
  >;
  switch (menuEvent.data.action) {
    case "file.newDrawing":
      runAppCommand(windowRef, "newDrawing");
      break;
    case "file.browse":
      runAppCommand(windowRef, "browse");
      break;
    case "file.export":
      runAppCommand(windowRef, "export");
      break;
    case "file.clear":
      runAppCommand(windowRef, "clear");
      break;
    case "edit.undo":
      runAppCommand(windowRef, "undo");
      break;
    case "edit.redo":
      runAppCommand(windowRef, "redo");
      break;
    default:
      break;
  }
});
