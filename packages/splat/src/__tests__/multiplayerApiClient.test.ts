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
        accessToken: "access-1",
      });
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    const result = await client.registerCollaborativeDocument(
      "automerge:doc-1",
      new Uint8Array([1, 2, 3]),
      "device-1",
    );

    expect(result).toEqual({
      collabDocUrl: "automerge:doc-1",
      joinSecret: "token-1",
      accessToken: "access-1",
      accessTokenScope: "owner",
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
          accessToken: "access-2",
          content: btoa("fake-doc-binary"),
        });
      }
      return mockJsonResponse(null);
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    const resolved = await client.resolveCollaborativeDocumentByJoinSecret(
      "join-abc",
      "device-1",
    );
    const missing = await client.resolveCollaborativeDocumentByJoinSecret(
      "join-missing",
      "device-1",
    );

    expect(resolved).toEqual({
      collabDocUrl: "automerge:doc-2",
      joinSecret: "token-2",
      accessToken: "access-2",
      accessTokenScope: "device",
      content: btoa("fake-doc-binary"),
    });
    expect(missing).toBeNull();
    expect(requests[0]).toContain(
      "/resolveAnonymousCollaborativeDocument?batch=1&input=",
    );
    expect(decodeURIComponent(requests[0])).toContain(
      '"joinSecret":"join-abc"',
    );
    expect(decodeURIComponent(requests[0])).toContain('"deviceTag":"device-1"');
  });

  test("resolve throws when content is missing from response", async () => {
    installFetchMock(async () => {
      return mockJsonResponse({
        collabDocUrl: "automerge:doc-3",
        joinSecret: "token-3",
        accessToken: "access-3",
      });
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    await expect(
      client.resolveCollaborativeDocumentByJoinSecret(
        "join-no-content",
        "device-1",
      ),
    ).rejects.toThrow(
      "Invalid response from resolveAnonymousCollaborativeDocument",
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
        "device-1",
      ),
    ).rejects.toThrow("Invalid response from registerCollaborativeDocument");
  });

  test("claimCollaborativeDocument sends auth header and parses response", async () => {
    const requests: Array<{
      url: string;
      authorization: string | null;
    }> = [];
    installFetchMock(async (input, init) => {
      requests.push({
        url: input.toString(),
        authorization:
          init?.headers instanceof Headers
            ? init.headers.get("authorization")
            : init?.headers &&
                "Authorization" in (init.headers as Record<string, unknown>)
              ? String((init.headers as Record<string, unknown>).Authorization)
              : null,
      });
      return mockJsonResponse({
        documentId: "doc-claim-1",
        attached: true,
        isAdmin: true,
      });
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
      getAuthorizationToken: () => "session-key-1",
    });
    const result = await client.claimCollaborativeDocument("owner-access-1");

    expect(result).toEqual({
      documentId: "doc-claim-1",
      attached: true,
      isAdmin: true,
    });
    expect(requests[0]?.url).toContain("claimCollaborativeDocument");
    expect(requests[0]?.authorization).toBe("session-key-1");
  });
});
