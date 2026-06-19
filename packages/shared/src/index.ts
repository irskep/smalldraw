export type AppErrorCode =
  | "DOCUMENT_CONTENT_MISSING"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_SHARE_LINK_INVALID"
  | "DOCUMENT_ACCESS_DENIED"
  | "DOCUMENT_AUTH_REQUIRED"
  | "DOCUMENT_STORAGE_UNAVAILABLE"
  | "NETWORK_UNAVAILABLE"
  | "UNKNOWN";

export type AppErrorSeverity = "recoverable" | "fatal";

export type AppError = {
  code: AppErrorCode;
  title: string;
  message: string;
  severity: AppErrorSeverity;
  retryable: boolean;
  details?: Record<string, string | number | boolean | null>;
};

export class AppErrorException extends Error {
  readonly appError: AppError;

  constructor(appError: AppError, options?: { cause?: unknown }) {
    super(appError.message, { cause: options?.cause });
    this.name = "AppErrorException";
    this.appError = appError;
  }
}

export function createAppError(error: AppError): AppError {
  return Object.freeze({ ...error });
}

export function isAppError(input: unknown): input is AppError {
  if (!input || typeof input !== "object") {
    return false;
  }
  const candidate = input as Partial<AppError>;
  return (
    isAppErrorCode(candidate.code) &&
    typeof candidate.title === "string" &&
    typeof candidate.message === "string" &&
    (candidate.severity === "recoverable" || candidate.severity === "fatal") &&
    typeof candidate.retryable === "boolean"
  );
}

export const DRAW_APP_PATH = "/draw/";
export const PORTAL_ROUTE_PATTERNS = [
  "/",
  "/account",
  "/admin",
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/drawings/deleted",
  "/invitation/:token",
  "/admin/users/:username",
  "/admin/users/:username/documents/:documentId",
] as const;

export type DrawingAppDocumentUrlParams =
  | { type: "new" }
  | { type: "account"; documentId: string }
  | { type: "local"; docUrl: string }
  | { type: "join"; joinSecret: string };

export function buildDrawingAppUrl(
  baseUrl: string,
  params?: DrawingAppDocumentUrlParams,
): string {
  const url = new URL(resolveDrawingAppBaseUrl(baseUrl));
  url.search = "";
  if (!params) {
    return url.toString();
  }
  switch (params.type) {
    case "new":
      url.searchParams.set("new", "1");
      break;
    case "account":
      url.searchParams.set("doc", params.documentId);
      break;
    case "local":
      url.searchParams.set("local", params.docUrl);
      break;
    case "join":
      url.searchParams.set("join", params.joinSecret);
      break;
  }
  return url.toString();
}

export function resolveDrawingAppBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = normalizeDrawPath(url.pathname);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function buildDrawingAppRedirectPath(currentHref: string): string {
  const url = new URL(currentHref);
  return `${url.pathname}${url.search}`;
}

export function isPortalRoutePath(pathname: string): boolean {
  const normalized = normalizePortalRoutePath(pathname);
  return PORTAL_ROUTE_PATTERNS.some((pattern) =>
    portalRoutePatternMatchesPath(pattern, normalized),
  );
}

function normalizeDrawPath(pathname: string): string {
  if (pathname === DRAW_APP_PATH) {
    return pathname;
  }
  if (pathname === "/" || pathname === "") {
    return DRAW_APP_PATH;
  }
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function normalizePortalRoutePath(pathname: string): string {
  if (pathname === "") {
    return "/";
  }
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function portalRoutePatternMatchesPath(
  pattern: (typeof PORTAL_ROUTE_PATTERNS)[number],
  pathname: string,
): boolean {
  if (!pattern.includes(":")) {
    return pattern === pathname;
  }

  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => {
    return segment.startsWith(":") || segment === pathSegments[index];
  });
}

export function getAppError(input: unknown): AppError | null {
  if (input instanceof AppErrorException) {
    return input.appError;
  }
  if (isAppError(input)) {
    return input;
  }
  return null;
}

export type DocumentAccessTokenScope = "owner" | "device";
export type DocumentTokenScope = "share" | DocumentAccessTokenScope;

export function isDocumentAccessTokenScope(
  input: unknown,
): input is DocumentAccessTokenScope {
  return input === "owner" || input === "device";
}

export type AccountDocumentSummary = {
  id: string;
  name: string;
  isAdmin: boolean;
  thumbnailUrl: string | null;
};

export type AdminUserDocumentSummary = AccountDocumentSummary & {
  currentAdminHasAccess: boolean;
};

export type AdminUserDocumentDetails = {
  document: AdminUserDocumentSummary;
  members: DocumentMember[];
  accessTokens: DocumentAccessToken[];
};

export type AdminUserSession = {
  id: string;
  createdAt: Date;
  isCurrentAdminSession: boolean;
};

export type AdminUserSessionMutationResult = {
  revoked: number;
};

export type AccountDocumentDetails = AccountDocumentSummary & {
  isAdmin: boolean;
};

export type AccountDocumentMutationResult = {
  id: string;
  name: string;
};

export type DeletedAccountDocument = {
  id: string;
  deletedAt: Date;
};

export type DeletedAccountDocumentSummary = AccountDocumentSummary & {
  deletedAt: Date;
};

export type RemovedAccountDocument = {
  id: string;
};

export type RestoredAccountDocument = {
  id: string;
};

export type CreatedAccountDocument = {
  document: AccountDocumentMutationResult;
};

export type DocumentInvitationToken = {
  token: string;
};

export type AcceptedDocumentInvitation = {
  documentId: string;
};

export type DocumentMember = {
  id: string;
  username: string;
  isAdmin: boolean;
};

export type DocumentAccessToken = {
  id: string;
  documentId: string;
  scope: DocumentTokenScope;
  tag: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export type RevokeDocumentAccessTokenResult = {
  revoked: boolean;
};

export type SplatDocumentOpenIntent =
  | { kind: "open-last-local" }
  | { kind: "create-new-document" }
  | { kind: "open-local-document"; docUrl: string }
  | { kind: "open-share-link"; joinSecret: string }
  | { kind: "open-account-document"; documentId: string };

export type AccountCollaborativeDocumentSummary = {
  documentId: string;
  name: string;
  isAdmin: boolean;
  thumbnailUrl: string | null;
};

export type RegisteredCollaborativeDocument = {
  collabDocUrl: string;
  joinSecret: string;
  accessToken: string;
  accessTokenScope: "owner";
};

export type AnonymousCollaborativeDocumentResolution = {
  collabDocUrl: string;
  joinSecret: string;
  accessToken: string;
  accessTokenScope: "device";
  content: string;
};

export type AccountCollaborativeDocumentResolution = {
  collabDocUrl: string;
  accessToken: string;
  accessTokenScope: DocumentAccessTokenScope;
  content: string;
};

export type ClaimCollaborativeDocumentResult = {
  documentId: string;
  attached: boolean;
  isAdmin: boolean;
};

export type DocumentThumbnailUploadTarget = {
  uploadUrl: string;
};

export * from "./parentalControls";

function isAppErrorCode(input: unknown): input is AppErrorCode {
  return (
    input === "DOCUMENT_CONTENT_MISSING" ||
    input === "DOCUMENT_NOT_FOUND" ||
    input === "DOCUMENT_SHARE_LINK_INVALID" ||
    input === "DOCUMENT_ACCESS_DENIED" ||
    input === "DOCUMENT_AUTH_REQUIRED" ||
    input === "DOCUMENT_STORAGE_UNAVAILABLE" ||
    input === "NETWORK_UNAVAILABLE" ||
    input === "UNKNOWN"
  );
}
