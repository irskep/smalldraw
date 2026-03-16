import { afterEach, describe, expect, test } from "bun:test";
import { createMultiplayerApiClient } from "../app/createMultiplayerApiClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (typeof window !== "undefined") {
    window.fetch = originalFetch;
  }
});

function mockJsonResponse(data: unknown): Response {
  return new Response(JSON.stringify([{ result: { data } }]), {
    headers: { "content-type": "application/json" },
  });
}

function installFetchMock(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): void {
  const mockFetch = handler as unknown as typeof fetch;
  globalThis.fetch = mockFetch;
  if (typeof window !== "undefined") {
    window.fetch = mockFetch;
  }
}

describe("createMultiplayerApiClient", () => {
  test("registerCollaborativeDocument sends mutation with base64 content", async () => {
    const requests: Array<{
      url: string;
      method: string | undefined;
      body: string | undefined;
    }> = [];
    installFetchMock(async (input, init) => {
      requests.push({
        url: input.toString(),
        method: init?.method,
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      return mockJsonResponse({
        collabDocUrl: "automerge:doc-1",
        joinSecret: "token-1",
      });
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    const result = await client.registerCollaborativeDocument(
      "automerge:doc-1",
      new Uint8Array([1, 2, 3]),
    );

    expect(result).toEqual({
      collabDocUrl: "automerge:doc-1",
      joinSecret: "token-1",
    });
    expect(requests[0].url).toContain("registerCollaborativeDocument");
    expect(requests[0].method).toBe("POST");
    expect(requests[0].body).toContain("automerge:doc-1");
    expect(requests[0].body).toContain(btoa(String.fromCharCode(1, 2, 3)));
  });

  test("resolveCollaborativeDocumentByJoinSecret sends query input and supports null", async () => {
    const requests: Array<string> = [];
    let callCount = 0;
    installFetchMock(async (input) => {
      requests.push(input.toString());
      callCount += 1;
      if (callCount === 1) {
        return mockJsonResponse({
          collabDocUrl: "automerge:doc-2",
          joinSecret: "token-2",
          content: btoa("fake-doc-binary"),
        });
      }
      return mockJsonResponse(null);
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    const resolved =
      await client.resolveCollaborativeDocumentByJoinSecret("join-abc");
    const missing =
      await client.resolveCollaborativeDocumentByJoinSecret("join-missing");

    expect(resolved).toEqual({
      collabDocUrl: "automerge:doc-2",
      joinSecret: "token-2",
      content: btoa("fake-doc-binary"),
    });
    expect(missing).toBeNull();
    expect(requests[0]).toContain(
      "/resolveAnonymousCollaborativeDocument?batch=1&input=",
    );
    expect(decodeURIComponent(requests[0])).toContain(
      '"joinSecret":"join-abc"',
    );
  });

  test("throws when response payload is invalid", async () => {
    installFetchMock(async () => {
      return mockJsonResponse({ joinSecret: "token-only" });
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    await expect(
      client.registerCollaborativeDocument(
        "automerge:doc-1",
        new Uint8Array([1]),
      ),
    ).rejects.toThrow("Invalid response from registerCollaborativeDocument");
  });
});
