import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import {
  appPath,
  basePath,
  isPublicUnauthenticatedRoute,
} from "../../config.js";
import { PortalRouter } from "../../utils/router.js";
import { trpc, trpcClient } from "../../utils/trpc.js";

const handleError = (error: Error, queryClient: QueryClient) => {
  if (
    error instanceof TRPCClientError &&
    error.data?.code === "UNAUTHORIZED" &&
    !isPublicUnauthenticatedRoute(window.location.pathname)
  ) {
    queryClient.clear();

    window.location.href = appPath(
      `login${window.location.pathname !== basePath ? `?${new URLSearchParams({ redirect: window.location.pathname + window.location.search + window.location.hash })}` : ""}`,
    );

    return true;
  }
  // Note: here a global error handler could be implemented e.g. using a toast

  return false;
};

export const App = ({ onPageChange }: { onPageChange?: () => void }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            handleError(error, queryClient);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            handleError(error, queryClient);
          },
        }),
        defaultOptions: {
          queries: {
            retry: (failureCount: number, error: Error) => {
              // Don't retry if we got an HTTP response (4xx/5xx won't change on retry)
              if (error instanceof TRPCClientError && error.data) {
                return false;
              }
              // Retry network errors up to 3 times
              return failureCount < 3;
            },
          },
          mutations: {
            // Never retry mutations (not idempotent)
            retry: false,
          },
        },
      }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <PortalRouter onPageChange={onPageChange} />
      </QueryClientProvider>
    </trpc.Provider>
  );
};
