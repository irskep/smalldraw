import "@smalldraw/splat/styles.css";
import {
  buildJoinedCatalogDocUrl,
  createKidsDrawApp,
  type KidsDrawApp,
} from "@smalldraw/splat";
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
  let app: KidsDrawApp | null = null;
  const openDocumentFromLocation = async (): Promise<void> => {
    if (!app) {
      return;
    }
    const intent = resolveSplatStartupIntent(window.location.search);
    const docUrl = resolveCatalogDocUrlForNavigation(intent);
    if (!docUrl) {
      return;
    }
    await app.commands.openDocument(docUrl);
  };
  const requestOpenDocumentFromLocation = (): void => {
    void openDocumentFromLocation().catch((error) => {
      console.warn("[splat-web] document navigation failed", { error });
    });
  };
  app = await createKidsDrawApp({
    container,
    assetBaseUrl: multiplayerConfig.assetBaseUrl,
    multiplayer: {
      ...multiplayerConfig,
      startupIntent,
    },
    onDocumentOpenRequested: (summary, docUrl) => {
      const nextUrl = buildSplatCurrentDocumentUrl(window.location.href, {
        docUrl,
        collaborative: summary?.collaborative,
        collabDocUrl: summary?.collabDocUrl,
        accountAttached: summary?.accountAttached,
      });
      if (nextUrl !== window.location.href) {
        window.history.pushState(null, "", nextUrl);
      }
      requestOpenDocumentFromLocation();
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
  window.addEventListener("popstate", () => {
    requestOpenDocumentFromLocation();
  });
  (window as unknown as { kidsDrawApp?: typeof app }).kidsDrawApp = app;
} catch (error) {
  console.error("[splat-web] failed to start app", { error });
  renderStartupErrorScreen(container, error);
}

function resolveCatalogDocUrlForNavigation(
  intent: ReturnType<typeof resolveSplatStartupIntent>,
): string | null {
  switch (intent.kind) {
    case "open-local-document":
      return intent.docUrl;
    case "open-account-document":
      return buildJoinedCatalogDocUrl(`automerge:${intent.documentId}`);
    case "open-last-local":
    case "open-share-link":
    case "startup-error":
      return null;
  }
}
