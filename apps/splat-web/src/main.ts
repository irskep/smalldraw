import "@smalldraw/splat/styles.css";
import { createKidsDrawApp } from "@smalldraw/splat";
import { buildSplatCurrentDocumentUrl } from "./documentUrl";
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
  const app = await createKidsDrawApp({
    container,
    assetBaseUrl: multiplayerConfig.assetBaseUrl,
    multiplayer: {
      ...multiplayerConfig,
      startupIntent,
    },
    onCurrentDocumentSummaryChanged: (summary) => {
      const nextUrl = buildSplatCurrentDocumentUrl(
        window.location.href,
        summary,
      );
      if (nextUrl !== window.location.href) {
        window.history.replaceState(null, "", nextUrl);
      }
    },
  });

  (window as unknown as { kidsDrawApp?: typeof app }).kidsDrawApp = app;
} catch (error) {
  console.error("[splat-web] failed to start app", { error });
  renderStartupErrorScreen(container, error);
}
