import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import type { AppRouter } from "../../../server/src/trpc/appRouter.js";
import { apiProductionHost } from "../constants.js";

const getProdApiUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  return `https://${apiProductionHost}/api`;
};

const apiUrl = import.meta.env.PROD
  ? getProdApiUrl()
  : "http://localhost:3030/api";

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
