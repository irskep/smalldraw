import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";

export interface MultiplayerApiClient {
  registerCollaborativeDocument(
    documentId: string,
    content: Uint8Array,
  ): Promise<{
    collabDocUrl: string;
    joinSecret: string;
  }>;
  resolveCollaborativeDocumentByJoinSecret(joinSecret: string): Promise<{
    collabDocUrl: string;
    joinSecret: string;
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
    async registerCollaborativeDocument(documentId, content) {
      const contentBase64 = uint8ArrayToBase64(content);
      const result = await client.mutation("registerCollaborativeDocument", {
        documentId,
        content: contentBase64,
      });
      const parsed = parseRegisterResult(result);
      if (!parsed) {
        throw new Error("Invalid response from registerCollaborativeDocument");
      }
      return parsed;
    },
    async resolveCollaborativeDocumentByJoinSecret(joinSecret) {
      const result = await client.query(
        "resolveAnonymousCollaborativeDocument",
        {
          joinSecret,
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
): { collabDocUrl: string; joinSecret: string } | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { joinSecret?: unknown }).joinSecret !== "string"
  ) {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    joinSecret: (input as { joinSecret: string }).joinSecret,
  };
}

function parseResolveResult(
  input: unknown,
): { collabDocUrl: string; joinSecret: string; content: string } | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { joinSecret?: unknown }).joinSecret !== "string" ||
    typeof (input as { content?: unknown }).content !== "string"
  ) {
    return null;
  }
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    joinSecret: (input as { joinSecret: string }).joinSecret,
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
