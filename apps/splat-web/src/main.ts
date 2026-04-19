import "@smalldraw/splat/styles.css";
import { createKidsDrawApp } from "@smalldraw/splat";
import { buildSplatCurrentDocumentUrl } from "./documentUrl";
import {
  createBrowserMultiplayerConfig,
  resolveSplatStartupIntent,
} from "./multiplayerConfig";

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
  renderStartupFallback(container, error);
}

function renderStartupFallback(root: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 680px; margin: 48px auto; padding: 24px;">
      <h1 style="margin: 0 0 12px; font-size: 24px;">Could not open drawing</h1>
      <p style="margin: 0 0 16px; color: #333;">Startup failed. This should not leave a blank screen.</p>
      <pre style="background: #f6f6f6; border: 1px solid #ddd; border-radius: 8px; padding: 12px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(
        message,
      )}</pre>
      <div style="display: flex; gap: 8px; margin-top: 16px;">
        <button id="retry-startup" style="padding: 8px 12px; border: 1px solid #333; background: #fff; cursor: pointer;">Retry</button>
        <button id="reset-startup" style="padding: 8px 12px; border: 1px solid #c00; background: #fff; color: #900; cursor: pointer;">Reset Local Session</button>
      </div>
    </div>
  `;

  const retryButton = document.getElementById("retry-startup");
  retryButton?.addEventListener("click", () => {
    window.location.reload();
  });

  const resetButton = document.getElementById("reset-startup");
  resetButton?.addEventListener("click", async () => {
    await clearLocalSessionState();
    window.location.reload();
  });
}

async function clearLocalSessionState(): Promise<void> {
  localStorage.removeItem("kids-draw-doc-url");
  await deleteIndexedDb("kids-draw-documents");
}

async function deleteIndexedDb(databaseName: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
