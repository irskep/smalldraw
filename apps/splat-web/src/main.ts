import "@smalldraw/splat/styles.css";
import { createKidsDrawApp } from "@smalldraw/splat";
import { createSplatDocumentNavigationStore } from "./documentNavigation";
import {
  createBrowserMultiplayerConfig,
  resolveSplatStartupIntent,
} from "./multiplayerConfig";
import { renderStartupErrorScreen } from "./startupErrorScreen";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container");
}

try {
  const multiplayerConfig = createBrowserMultiplayerConfig();
  const startupIntent = resolveSplatStartupIntent(window.location.search);
  if (startupIntent.kind === "startup-error") {
    throw new Error(startupIntent.message);
  }
  const documentNavigation = createSplatDocumentNavigationStore({ window });
  let lastOpenedNavigationKey = documentNavigation.get().key;
  const baseApp = await createKidsDrawApp({
    container,
    assetBaseUrl: multiplayerConfig.assetBaseUrl,
    multiplayer: {
      ...multiplayerConfig,
      startupIntent,
    },
    onDocumentOpenRequested: (summary, docUrl) => {
      documentNavigation.pushDocument(summary, docUrl);
    },
    onCurrentDocumentSummaryChanged: (summary) => {
      lastOpenedNavigationKey =
        documentNavigation.replaceCurrentDocument(summary).key;
    },
  });
  const unbindNavigation = documentNavigation.subscribe((navigation) => {
    if (navigation.key === lastOpenedNavigationKey) {
      return;
    }
    lastOpenedNavigationKey = navigation.key;
    if (navigation.type !== "open-document") {
      return;
    }
    void baseApp.commands.openDocument(navigation.docUrl).catch((error) => {
      console.warn("[splat-web] document navigation failed", {
        docUrl: navigation.docUrl,
        error,
      });
    });
  });
  const app = {
    ...baseApp,
    destroy(): void {
      unbindNavigation();
      documentNavigation.dispose();
      baseApp.destroy();
    },
  };
  (window as unknown as { kidsDrawApp?: typeof app }).kidsDrawApp = app;
} catch (error) {
  console.error("[splat-web] failed to start app", { error });
  renderStartupErrorScreen(container, error);
}
