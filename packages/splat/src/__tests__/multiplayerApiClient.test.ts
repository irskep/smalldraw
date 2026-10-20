import { afterEach, describe, expect, test } from "bun:test";
import { cbor } from "@automerge/automerge-repo";
import { createAppError } from "@smalldraw/shared";
import {
  createMultiplayerApiClient,
  MultiplayerApiError,
} from "../app/createMultiplayerApiClient";

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

function mockTrpcErrorResponse(options: {
  message: string;
  trpcCode: string;
  httpStatus: number;
  appError: ReturnType<typeof createAppError>;
}): Response {
  return new Response(
    JSON.stringify([
      {
        error: {
          message: options.message,
          code: -32004,
          data: {
            code: options.trpcCode,
            httpStatus: options.httpStatus,
            appError: options.appError,
          },
        },
      },
    ]),
    {
      status: options.httpStatus,
      headers: { "content-type": "application/json" },
    },
  );
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
  test("listAccountCollaborativeDocuments includes browser credentials and parses metadata", async () => {
    const requests: Array<{
      url: string;
      credentials: RequestCredentials | undefined;
    }> = [];
    installFetchMock(async (input, init) => {
      requests.push({
        url: input.toString(),
        credentials: init?.credentials,
      });
      return mockJsonResponse([
        {
          documentId: "account-doc-1",
          name: "Kitchen sketch",
          isAdmin: true,
          thumbnailUrl: "https://cdn.example.com/thumb.png",
        },
        {
          documentId: "account-doc-2",
          name: "Untitled",
          isAdmin: false,
          thumbnailUrl: null,
        },
      ]);
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    const result = await client.listAccountCollaborativeDocuments();

    expect(result).toEqual([
      {
        documentId: "account-doc-1",
        name: "Kitchen sketch",
        isAdmin: true,
        thumbnailUrl: "https://cdn.example.com/thumb.png",
      },
      {
        documentId: "account-doc-2",
        name: "Untitled",
        isAdmin: false,
        thumbnailUrl: null,
      },
    ]);
    expect(requests[0]?.url).toContain("listAccountCollaborativeDocuments");
    expect(requests[0]?.credentials).toBe("include");
  });

  test("registerCollaborativeDocument sends binary snapshot bytes", async () => {
    const requests: Array<{
      url: string;
      method: string | undefined;
      body: { documentId: string; content: Uint8Array };
    }> = [];
    installFetchMock(async (input, init) => {
      requests.push({
        url: input.toString(),
        method: init?.method,
        body: cbor.decode(init?.body as Uint8Array) as {
          documentId: string;
          content: Uint8Array;
        },
      });
      return mockBinaryResponse({
        collabDocUrl: "automerge:doc-1",
        joinSecret: "token-1",
        accessToken: "access-1",
        accessTokenScope: "owner",
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
    expect(requests[0].body.documentId).toBe("automerge:doc-1");
    expect(requests[0].body.content).toEqual(new Uint8Array([1, 2, 3]));
  });

  test("resolveCollaborativeDocumentByJoinSecret sends query input and supports null", async () => {
    const requests: Array<string> = [];
    const inputs: unknown[] = [];
    let callCount = 0;
    installFetchMock(async (input, init) => {
      requests.push(input.toString());
      inputs.push(cbor.decode(init?.body as Uint8Array));
      callCount += 1;
      if (callCount === 1) {
        return mockBinaryResponse({
          collabDocUrl: "automerge:doc-2",
          joinSecret: "token-2",
          accessToken: "access-2",
          accessTokenScope: "device",
          content: new TextEncoder().encode("fake-doc-binary"),
        });
      }
      return mockBinaryResponse(null);
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
      content: new TextEncoder().encode("fake-doc-binary"),
    });
    expect(missing).toBeNull();
    expect(requests[0]).toContain(
      "/documents/resolveAnonymousCollaborativeDocument",
    );
    expect(inputs[0]).toEqual({
      joinSecret: "join-abc",
      deviceTag: "device-1",
    });
  });

  test("resolve throws when content is missing from response", async () => {
    installFetchMock(async () => {
      return mockBinaryResponse({
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

  test("resolveCollaborativeDocumentByAccountDocumentId includes credentials and parses response", async () => {
    const requests: Array<{
      url: string;
      credentials: RequestCredentials | undefined;
    }> = [];
    installFetchMock(async (input, init) => {
      requests.push({
        url: input.toString(),
        credentials: init?.credentials,
      });
      return mockBinaryResponse({
        collabDocUrl: "automerge:account-doc-1",
        accessToken: "account-access-1",
        accessTokenScope: "owner",
        content: new TextEncoder().encode("fake-account-doc-binary"),
      });
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    const resolved =
      await client.resolveCollaborativeDocumentByAccountDocumentId(
        "account-doc-1",
        "device-1",
      );

    expect(resolved).toEqual({
      collabDocUrl: "automerge:account-doc-1",
      accessToken: "account-access-1",
      accessTokenScope: "owner",
      content: new TextEncoder().encode("fake-account-doc-binary"),
    });
    expect(requests[0]?.url).toContain("resolveAccountCollaborativeDocument");
    expect(requests[0]?.credentials).toBe("include");
  });

  test("resolveCollaborativeDocumentByAccountDocumentId preserves typed app errors", async () => {
    const appError = createAppError({
      code: "DOCUMENT_CONTENT_MISSING",
      title: "Could not open drawing",
      message:
        "This drawing exists in your account, but its drawing content is missing from storage.",
      severity: "recoverable",
      retryable: false,
      details: { documentId: "account-doc-missing-content" },
    });
    installFetchMock(async () =>
      mockBinaryErrorResponse({
        message: appError.message,
        trpcCode: "NOT_FOUND",
        httpStatus: 404,
        appError,
      }),
    );

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    let thrown: unknown;
    try {
      await client.resolveCollaborativeDocumentByAccountDocumentId(
        "account-doc-missing-content",
        "device-1",
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(MultiplayerApiError);
    expect((thrown as MultiplayerApiError).appError).toEqual(appError);
  });

  test("throws when response payload is invalid", async () => {
    installFetchMock(async () => {
      return mockBinaryResponse({ joinSecret: "token-only" });
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

  test("claimCollaborativeDocument includes browser credentials and parses response", async () => {
    const requests: Array<{
      url: string;
      credentials: RequestCredentials | undefined;
    }> = [];
    installFetchMock(async (input, init) => {
      requests.push({
        url: input.toString(),
        credentials: init?.credentials,
      });
      return mockJsonResponse({
        documentId: "doc-claim-1",
        attached: true,
        isAdmin: true,
      });
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    const result = await client.claimCollaborativeDocument("owner-access-1");

    expect(result).toEqual({
      documentId: "doc-claim-1",
      attached: true,
      isAdmin: true,
    });
    expect(requests[0]?.url).toContain("claimCollaborativeDocument");
    expect(requests[0]?.credentials).toBe("include");
  });

  test("uploadDocumentThumbnail gets presigned URL and uploads directly", async () => {
    const requests: Array<{
      url: string;
      method: string | undefined;
      credentials: RequestCredentials | undefined;
      body: string | null;
      contentType: string | null;
    }> = [];
    installFetchMock(async (input, init) => {
      const url = input.toString();
      const method = init?.method?.toUpperCase() ?? "POST";
      const headers = new Headers(init?.headers as HeadersInit);
      requests.push({
        url,
        method,
        credentials: init?.credentials,
        body: typeof init?.body === "string" ? init.body : null,
        contentType: headers.get("Content-Type"),
      });
      if (url.includes("presigned.example.com")) {
        return new Response(null, { status: 200 });
      }
      return mockJsonResponse({
        uploadUrl:
          "https://presigned.example.com/documents/doc-thumb-1/thumbnail.png",
      });
    });

    const client = createMultiplayerApiClient({
      apiUrl: "http://localhost/api",
    });
    await Promise.all(
      Array.from({ length: 2 }, () =>
        client.uploadDocumentThumbnail(
          "doc-thumb-1",
          new Blob(["thumbnail-bytes"], { type: "image/png" }),
        ),
      ),
    );
    expect(requests).toHaveLength(2);

    expect(requests[0]?.url).toContain("uploadDocumentThumbnail");
    expect(requests[0]?.credentials).toBe("include");
    expect(requests[1]?.url).toBe(
      "https://presigned.example.com/documents/doc-thumb-1/thumbnail.png",
    );
    expect(requests[1]?.method).toBe("PUT");
    expect(requests[1]?.contentType).toBe("image/png");
    await client.uploadDocumentThumbnail(
      "doc-thumb-1",
      new Blob(["changed-thumbnail"], { type: "image/png" }),
    );
    expect(requests).toHaveLength(4);
  });
});

test("account session queries and logout use browser credentials", async () => {
  const requests: Array<{ url: string; credentials: string | undefined }> = [];
  installFetchMock(async (input, init) => {
    requests.push({ url: input.toString(), credentials: init?.credentials });
    return mockJsonResponse(
      input.toString().includes("me?")
        ? { id: "account-1", username: "Pat" }
        : null,
    );
  });
  const client = createMultiplayerApiClient({ apiUrl: "http://localhost/api" });
  expect(await client.getCurrentAccount()).toEqual({
    id: "account-1",
    username: "Pat",
  });
  await client.signOut();
  expect(requests.map((r) => r.credentials)).toEqual(["include", "include"]);
  expect(requests[1].url).toContain("logout");
});

test("only an unauthorized account response becomes signed-out", async () => {
  installFetchMock(async () =>
    mockTrpcErrorResponse({
      message: "UNAUTHORIZED",
      trpcCode: "UNAUTHORIZED",
      httpStatus: 401,
      appError: createAppError({
        code: "DOCUMENT_AUTH_REQUIRED",
        title: "Sign in",
        message: "Sign in",
        severity: "recoverable",
        retryable: false,
      }),
    }),
  );
  const client = createMultiplayerApiClient({ apiUrl: "http://localhost/api" });
  expect(await client.getCurrentAccount()).toBeNull();
  // Expired sessions can still complete a sign-out action successfully.
  await client.signOut();
  installFetchMock(async () => {
    throw new Error("Offline");
  });
  await expect(client.getCurrentAccount()).rejects.toThrow();
});

test("an oversized HTTP upload reports a useful error even when the parser returns HTML", async () => {
  installFetchMock(
    async () =>
      new Response("<html>PayloadTooLargeError</html>", { status: 413 }),
  );
  const client = createMultiplayerApiClient({ apiUrl: "http://localhost/api" });
  await expect(
    client.registerCollaborativeDocument(
      "automerge:doc",
      new Uint8Array([1]),
      "device",
    ),
  ).rejects.toThrow("This drawing is too large to upload");
});

function mockBinaryResponse(result: unknown): Response {
  return new Response(cbor.encode({ result }) as Uint8Array<ArrayBuffer>, {
    headers: { "content-type": "application/cbor" },
  });
}
async function mockBinaryErrorResponse(
  options: Parameters<typeof mockTrpcErrorResponse>[0],
): Promise<Response> {
  const response = mockTrpcErrorResponse(options);
  const [envelope] = await response.json();
  return new Response(cbor.encode(envelope) as Uint8Array<ArrayBuffer>, {
    status: response.status,
    headers: { "content-type": "application/cbor" },
  });
}
