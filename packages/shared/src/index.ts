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

export type AccountCollaborativeDocumentSummary = {
  documentId: string;
  name: string;
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
