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
  const browseOnStart =
    new URLSearchParams(window.location.search).get("browse") === "1";
  const startupIntent = resolveSplatStartupIntent(window.location.search);
  const accountSessionExpected =
    new URLSearchParams(window.location.search).get("account") === "1";
  if (startupIntent.kind === "startup-error") {
    throw new Error(startupIntent.message);
  }
  const documentNavigation = createSplatDocumentNavigationStore({ window });
  const baseApp = await createKidsDrawApp({
    container,
    assetBaseUrl: multiplayerConfig.assetBaseUrl,
    multiplayer: {
      ...multiplayerConfig,
      startupIntent,
      accountSessionExpected,
    },
    onDocumentCreationCancelled: () => {
      window.location.assign(new URL("../", window.location.href).href);
    },
    onDocumentOpenRequested: (summary, docUrl) => {
      documentNavigation.pushDocument(summary, docUrl);
    },
    onCurrentDocumentSummaryChanged: (summary) => {
      documentNavigation.replaceCurrentDocument(summary);
    },
  });
  if (browseOnStart) baseApp.commands.browse();
  const unbindNavigation = documentNavigation.subscribeRequests(
    (navigation) => {
      if (navigation.type !== "open-document") {
        return;
      }
      void baseApp.commands.openDocument(navigation.docUrl).catch((error) => {
        console.warn("[splat-web] document navigation failed", {
          docUrl: navigation.docUrl,
          error,
        });
      });
    },
  );
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
