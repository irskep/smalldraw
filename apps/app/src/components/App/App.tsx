import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import { removeLocalDb } from "../../utils/removeLocalDb.js";
import { router } from "../../utils/router.js";
import { clearAuthorizationToken, trpc, trpcClient } from "../../utils/trpc.js";

const handleError = (error: Error, queryClient: QueryClient) => {
  if (
    error instanceof TRPCClientError &&
    error.data?.code === "UNAUTHORIZED" &&
    window.location.pathname !== "/login" &&
    window.location.pathname !== "/register"
  ) {
    clearAuthorizationToken();
    removeLocalDb();
    queryClient.clear();

    // need to do a hard-reload of the page since it's not possible to
    // properly cleanup automerge-repo and it will continue trying to reconnect
    window.location.href = `/login${window.location.pathname !== "/" ? `?redirect=${window.location.pathname}` : ""}`;

    // router.navigate({
    //   to: "/login",
    //   search:
    //     window.location.pathname !== "/"
    //       ? { redirect: window.location.pathname }
    //       : undefined,
    // });

    return true;
  }
  // Note: here a global error handler could be implemented e.g. using a toast

  return false;
};

export const App: React.FC = () => {
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
      })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  );
};
