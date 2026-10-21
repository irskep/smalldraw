import { describe, expect, test } from "bun:test";
import path from "node:path";
import { isPortalRoutePath } from "@smalldraw/shared";

describe("portal production fallback routes", () => {
  test("cover every client portal route", async () => {
    const router = await Bun.file(
      path.resolve(import.meta.dir, "../../app/src/utils/router.tsx"),
    ).text();
    const portalRoutes = Array.from(
      router.matchAll(/path=\{appPath\(\s*"([^"]*)"\s*,?\s*\)\}/g),
      ([, route]) => `/${route}`,
    );
    expect(portalRoutes).toContain("/");
    expect(portalRoutes).toContain(
      "/admin/users/:username/documents/:documentId",
    );
    const uncoveredRoutes = portalRoutes.filter(
      (route) => !isPortalRoutePath(route.replaceAll(/:[^/]+/g, "example")),
    );
    expect(uncoveredRoutes).toEqual([]);
  });
});
