import type { SplatDocumentOpenIntent } from "./index";

export const DRAW_APP_PATH = "/draw/";
export type DrawingAppDocumentUrlParams =
  | {
      type: "new";
      account?: boolean;
      coloring?: boolean;
      coloringPageId?: string;
    }
  | { type: "account"; documentId: string }
  | { type: "local"; docUrl: string }
  | { type: "join"; joinSecret: string };

/** Catalog keys and Automerge URLs are internal; addresses contain only IDs. */
export function drawingDocumentId(value: string): string {
  return value.replace(/^(?:automerge:|catalog-collab:)/, "");
}

export function resolveDrawingAppBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const match = url.pathname.match(/^(.*\/draw)(?:\/|$)/);
  url.pathname = match
    ? `${match[1]}/`
    : url.pathname === "/"
      ? DRAW_APP_PATH
      : `${url.pathname.replace(/\/$/, "")}/`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function buildDrawingAppUrl(
  baseUrl: string,
  params?: DrawingAppDocumentUrlParams,
): string {
  const url = new URL(resolveDrawingAppBaseUrl(baseUrl));
  if (!params) return url.href;
  switch (params.type) {
    case "new":
      url.pathname += "new";
      if (params.coloringPageId)
        url.searchParams.set("page", params.coloringPageId);
      else if (params.coloring) url.searchParams.set("picker", "coloring");
      if (params.account) url.searchParams.set("account", "1");
      break;
    case "account":
      url.pathname += encodeURIComponent(params.documentId);
      break;
    case "local":
      url.pathname += encodeURIComponent(drawingDocumentId(params.docUrl));
      break;
    case "join":
      url.pathname += `shared/${encodeURIComponent(params.joinSecret)}`;
      break;
  }
  return url.href;
}

export type DrawingRouteIntent =
  | SplatDocumentOpenIntent
  | { kind: "startup-error"; message: string };

/** Accept existing query links as well as canonical paths. Only writers canonicalize. */
export function parseDrawingAppUrl(href: string): DrawingRouteIntent {
  const url = new URL(
    href.startsWith("?") ? `/draw/${href}` : href,
    "https://drawing.invalid",
  );
  const params = url.searchParams;
  const invalid = (
    message = "This drawing URL is not valid.",
  ): DrawingRouteIntent => ({ kind: "startup-error", message });
  const match = url.pathname.match(/\/draw(?:\/(.*))?$/);
  const path = match
    ? (match[1] ?? "").replace(/\/$/, "")
    : ["/", "/index.html"].includes(url.pathname)
      ? ""
      : null;
  if (path === null) return invalid();
  const legacy = ["new", "join", "doc", "local"].filter((key) =>
    params.has(key),
  );
  if (legacy.length > 1 || (path && legacy.length))
    return invalid("Open only one drawing URL at a time.");
  let intent: DrawingRouteIntent;
  if (legacy.length) {
    const key = legacy[0];
    const value = params.get(key)!;
    if (!value) return invalid();
    if (key === "join") intent = { kind: "open-share-link", joinSecret: value };
    else if (key === "doc")
      intent = { kind: "open-account-document", documentId: value };
    else if (key === "local")
      intent = { kind: "open-local-document", docUrl: value };
    else if (params.has("page") && value !== "coloring")
      return invalid("This coloring page could not be found.");
    else
      intent = {
        kind: "create-new-document",
        ...(params.has("page")
          ? { coloringPageId: params.get("page")! }
          : value === "coloring"
            ? { picker: "coloring" as const }
            : {}),
      };
  } else if (!path) intent = { kind: "open-last-local" };
  else if (path === "new")
    intent = {
      kind: "create-new-document",
      ...(params.has("page")
        ? { coloringPageId: params.get("page")! }
        : params.get("picker") === "coloring"
          ? { picker: "coloring" as const }
          : {}),
    };
  else {
    const parts = path.split("/");
    try {
      const id = decodeURIComponent(parts.at(-1)!);
      if (!/^[A-Za-z0-9_-]+$/.test(id)) return invalid();
      if (parts.length === 2 && parts[0] === "shared")
        intent = { kind: "open-share-link", joinSecret: id };
      else if (parts.length === 1 && id !== "shared")
        intent = { kind: "open-document", documentId: id };
      else return invalid();
    } catch {
      return invalid();
    }
  }
  return intent;
}
