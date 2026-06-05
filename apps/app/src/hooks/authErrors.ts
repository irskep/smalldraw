export type AuthMode = "login" | "register";

export type AuthResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
    };

export function getAuthFailureMessage(error: unknown, mode: AuthMode): string {
  const message = getErrorMessage(error);
  if (mode === "login") {
    return getLoginFailureMessage(message, error);
  }
  return getRegisterFailureMessage(message, error);
}

function getLoginFailureMessage(message: string | null, error: unknown): string {
  if (message?.includes("user not registered")) {
    return "No account exists for that username.";
  }
  if (message?.includes("login already started")) {
    return "Login is already in progress. Wait a few seconds and try again.";
  }
  if (isNetworkLikeError(error)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return "The username or password is incorrect.";
}

function getRegisterFailureMessage(
  message: string | null,
  error: unknown,
): string {
  if (message?.includes("user already registered")) {
    return "That username is already taken.";
  }
  if (isNetworkLikeError(error)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return "Sign up failed. Please try again.";
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }
  return null;
}

function isNetworkLikeError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeTrpcError = error as {
    data?: unknown;
    cause?: unknown;
    message?: unknown;
  };
  return (
    maybeTrpcError.data === undefined &&
    typeof maybeTrpcError.message === "string" &&
    /fetch|network|load failed|failed to fetch/i.test(maybeTrpcError.message)
  );
}
