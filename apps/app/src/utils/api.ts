import { createTRPCClient, httpBatchLink, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "../../../server/src/trpc/appRouter";
import { handleApiError } from "./apiErrors";

const errors: TRPCLink<AppRouter> =
  () =>
  ({ next, op }) =>
    observable((observer) =>
      next(op).subscribe({
        next: (value) => observer.next(value),
        complete: () => observer.complete(),
        error: (error) => {
          handleApiError(error);
          observer.error(error);
        },
      }),
    );
const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) throw new Error("Missing required env var: VITE_API_URL");
export const api = createTRPCClient<AppRouter>({
  links: [
    errors,
    httpBatchLink({
      url: apiUrl,
      fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
    }),
  ],
});
