import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import type { AppRouter } from "../../../server/src/trpc/appRouter.js";

const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) {
  throw new Error("Missing required env var: VITE_API_URL");
}

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: apiUrl,
      fetch(url, init) {
        return fetch(url, {
          ...init,
          credentials: "include",
        });
      },
    }),
  ],
});
