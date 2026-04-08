import { afterEach, describe, expect, test } from "bun:test";
import { createBasicAuthHeader, runCli } from "./cli";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.SMALLDRAW_ADMIN_USERNAME;
  delete process.env.SMALLDRAW_ADMIN_PASSWORD;
});

describe("server cli", () => {
  test("createBasicAuthHeader encodes username and password", () => {
    expect(createBasicAuthHeader("admin", "asdfjkl;")).toBe(
      `Basic ${Buffer.from("admin:asdfjkl;").toString("base64")}`,
    );
  });

  test("admin me uses basic auth from env", async () => {
    process.env.SMALLDRAW_ADMIN_USERNAME = "admin";
    process.env.SMALLDRAW_ADMIN_PASSWORD = "asdfjkl;";

    const requests: Array<{ url: string; authorization: string | null }> = [];
    globalThis.fetch = (async (input, init) => {
      requests.push({
        url: input.toString(),
        authorization:
          init && "headers" in init
            ? ((init.headers as Record<string, string>).authorization ?? null)
            : null,
      });
      return new Response(
        JSON.stringify([
          {
            result: {
              data: {
                id: "user-1",
                username: "admin",
              },
            },
          },
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    await expect(runCli(["admin", "me"])).resolves.toEqual({
      id: "user-1",
      username: "admin",
    });
    expect(requests[0]?.url).toContain("adminMe");
    expect(requests[0]?.authorization).toBe(
      createBasicAuthHeader("admin", "asdfjkl;"),
    );
  });
});
