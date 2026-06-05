import { describe, expect, test } from "bun:test";
import path from "node:path";
import { isAccountAppRoutePath } from "@smalldraw/shared";

describe("account app production fallback routes", () => {
  test("cover every generated account app route", async () => {
    const generatedRouteTreePath = path.resolve(
      import.meta.dir,
      "../../app/src/routeTree.gen.ts",
    );
    const generatedRouteTree = await Bun.file(generatedRouteTreePath).text();
    const fullPathUnion = generatedRouteTree.match(
      /fullPaths:\s*([\s\S]*?)\n\s*fileRoutesByTo:/,
    );

    expect(fullPathUnion).not.toBeNull();

    const accountRoutes = Array.from(
      fullPathUnion?.[1].matchAll(/\|\s*'([^']+)'/g) ?? [],
      ([, route]) => route,
    );

    expect(accountRoutes).toContain("/");
    expect(accountRoutes.length).toBeGreaterThan(0);

    const uncoveredRoutes = accountRoutes.filter((route) => {
      return !isAccountAppRoutePath(toSamplePath(route));
    });

    expect(uncoveredRoutes).toEqual([]);
  });
});

function toSamplePath(route: string): string {
  return route.replaceAll(/\$[^/]+/g, "example");
}
