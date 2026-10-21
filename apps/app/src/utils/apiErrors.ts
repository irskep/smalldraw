import { TRPCClientError } from "@trpc/client";

import { appPath, isPublicUnauthenticatedRoute } from "../config";

export function isUnauthorized(error: unknown): boolean {
  return (
    error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED"
  );
}

export function handleApiError(error: unknown) {
  if (
    !isUnauthorized(error) ||
    isPublicUnauthenticatedRoute(window.location.pathname)
  )
    return;
  const redirect =
    window.location.pathname + window.location.search + window.location.hash;
  window.location.href = appPath(`login?${new URLSearchParams({ redirect })}`);
}
