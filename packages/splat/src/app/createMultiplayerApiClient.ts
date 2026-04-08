import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";

export interface MultiplayerApiClient {
  registerCollaborativeDocument(
    documentId: string,
    content: Uint8Array,
    deviceTag: string,
  ): Promise<{
    collabDocUrl: string;
    joinSecret: string;
    accessToken: string;
  }>;
  resolveCollaborativeDocumentByJoinSecret(
    joinSecret: string,
    deviceTag: string,
  ): Promise<{
    collabDocUrl: string;
    joinSecret: string;
    accessToken: string;
    content: string;
  } | null>;
}

export function createMultiplayerApiClient(options: {
  apiUrl: string;
}): MultiplayerApiClient {
  const client = createTRPCUntypedClient({
    links: [httpBatchLink({ url: options.apiUrl })],
  });

  return {
    async registerCollaborativeDocument(documentId, content, deviceTag) {
      const contentBase64 = uint8ArrayToBase64(content);
      const result = await client.mutation("registerCollaborativeDocument", {
        documentId,
        content: contentBase64,
        deviceTag,
      });
      const parsed = parseRegisterResult(result);
      if (!parsed) {
        throw new Error("Invalid response from registerCollaborativeDocument");
      }
      return parsed;
    },
    async resolveCollaborativeDocumentByJoinSecret(joinSecret, deviceTag) {
      const result = await client.query(
        "resolveAnonymousCollaborativeDocument",
        {
          joinSecret,
          deviceTag,
        },
      );
      if (result == null) {
        return null;
      }
      const parsed = parseResolveResult(result);
      if (!parsed) {
        throw new Error(
          "Invalid response from resolveAnonymousCollaborativeDocument",
        );
      }
      return parsed;
    },
  };
}

function parseRegisterResult(
  input: unknown,
): { collabDocUrl: string; joinSecret: string; accessToken: string } | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { joinSecret?: unknown }).joinSecret !== "string" ||
    typeof (input as { accessToken?: unknown }).accessToken !== "string"
  ) {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    joinSecret: (input as { joinSecret: string }).joinSecret,
    accessToken: (input as { accessToken: string }).accessToken,
  };
}

function parseResolveResult(input: unknown): {
  collabDocUrl: string;
  joinSecret: string;
  accessToken: string;
  content: string;
} | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { joinSecret?: unknown }).joinSecret !== "string" ||
    typeof (input as { accessToken?: unknown }).accessToken !== "string" ||
    typeof (input as { content?: unknown }).content !== "string"
  ) {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    joinSecret: (input as { joinSecret: string }).joinSecret,
    accessToken: (input as { accessToken: string }).accessToken,
    content: (input as { content: string }).content,
  };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
