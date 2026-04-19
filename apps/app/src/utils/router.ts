import { createRouter } from "@tanstack/react-router";
import { basePath } from "../config.js";
import { routeTree } from "../routeTree.gen.js";

export const router = createRouter({
  routeTree,
  basepath: basePath,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
