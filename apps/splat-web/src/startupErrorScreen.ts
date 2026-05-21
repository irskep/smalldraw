import "./startupErrorScreen.css";

import { isDocumentAccessError } from "@smalldraw/splat";
import { createDocumentAccessState } from "@smalldraw/design-system";

export function renderStartupErrorScreen(
  root: HTMLElement,
  error: unknown,
): void {
  const model = buildStartupErrorScreenModel(error, window.location.href);
  const state = createDocumentAccessState(model);
  const shell = document.createElement("div");
  shell.className = "splat-web-startup-error-screen";
  state.setOnRetry(() => {
    window.location.reload();
  });
  state.setOnReset(async () => {
    await clearLocalSessionState();
    window.location.reload();
  });
  shell.append(state.el);
  root.replaceChildren(shell);
}

export function buildStartupErrorScreenModel(
  error: unknown,
  currentHref: string,
): {
  title: string;
  description: string;
  message: string;
  loginUrl?: string;
  signupUrl?: string;
} {
  if (isDocumentAccessError(error) && error.reason === "auth_required") {
    return {
      title: error.title,
      description:
        "This drawing needs account access. Log in or sign up to continue.",
      message: error.userMessage,
      loginUrl: buildAccountAuthUrl("login", currentHref),
      signupUrl: buildAccountAuthUrl("register", currentHref),
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    title: "Could not open drawing",
    description:
      "The requested drawing could not be opened. Try again or reset this browser's local drawing session.",
    message,
  };
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

function buildAccountAuthUrl(
  route: "login" | "register",
  currentHref: string,
): string {
  const current = new URL(currentHref);
  const redirect = `${current.pathname}${current.search}`;
  const authUrl = new URL(`/account/${route}`, current.origin);
  authUrl.searchParams.set("redirect", redirect);
  return authUrl.toString();
}
