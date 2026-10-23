import { expect, test } from "vitest";

import { portalScope } from "../config";

const origin = "https://splatterboard.app";
test.each([
  "/",
  "/data",
  "/privacy#analytics",
  "/login?redirect=%2Faccount",
  "/drawings/deleted",
  "/admin/users/a%2Fb/documents/c%20d",
])("routes portal link %s", (path) => {
  expect(portalScope(origin).test(path)).toBe(true);
  expect(portalScope(origin).test(origin + path)).toBe(true);
});
test.each([
  "/coloringbook",
  "/coloringbook/",
  "/coloringbook?category=animals",
  "/coloringbook/dinosaurs",
  "/draw/",
  "/draw?new=1",
  "/api/v1/me",
  "/s/token",
  "/d/id",
  "mailto:splatterboard@fastmail.com",
  "https://example.com/data",
])("leaves %s to the browser", (path) => {
  expect(portalScope(origin).test(path)).toBe(false);
  if (path.startsWith("/")) {
    expect(portalScope(origin).test(origin + path)).toBe(false);
  }
});
test("scopes a portal mounted below the origin root", () => {
  const scope = portalScope(origin, "/portal/");
  expect(scope.test("/portal/data")).toBe(true);
  expect(scope.test(origin + "/portal/admin")).toBe(true);
  expect(scope.test("/data")).toBe(false);
  expect(scope.test("/portal/draw/?new=1")).toBe(false);
  expect(scope.test("/portal/coloringbook")).toBe(false);
  expect(scope.test(origin + "/portal/coloringbook/animals")).toBe(false);
});
