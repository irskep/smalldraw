import { describe, expect, test } from "bun:test";
import path from "node:path";
import { isPortalRoutePath } from "@smalldraw/shared";

describe("portal production fallback routes", () => {
  test("cover every generated portal route", async () => {
    const generatedRouteTreePath = path.resolve(
      import.meta.dir,
      "../../app/src/routeTree.gen.ts",
    );
    const generatedRouteTree = await Bun.file(generatedRouteTreePath).text();
    const fullPathUnion = generatedRouteTree.match(
      /fullPaths:\s*([\s\S]*?)\n\s*fileRoutesByTo:/,
    );

    expect(fullPathUnion).not.toBeNull();

    const portalRoutes = Array.from(
      fullPathUnion?.[1].matchAll(/\|\s*'([^']+)'/g) ?? [],
      ([, route]) => route,
    );

    expect(portalRoutes).toContain("/");
    expect(portalRoutes.length).toBeGreaterThan(0);

    const uncoveredRoutes = portalRoutes.filter((route) => {
      return !isPortalRoutePath(toSamplePath(route));
    });

    expect(uncoveredRoutes).toEqual([]);
  });
});

function toSamplePath(route: string): string {
  return route.replaceAll(/\$[^/]+/g, "example");
}
