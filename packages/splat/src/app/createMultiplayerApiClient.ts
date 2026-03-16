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
    content?: string;
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
      const parsed = parseCollaborativeDocumentResult(result);
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
      const parsed = parseCollaborativeDocumentResult(result);
      if (!parsed) {
        throw new Error(
          "Invalid response from resolveAnonymousCollaborativeDocument",
        );
      }
      return parsed;
    },
  };
}

function parseCollaborativeDocumentResult(
  input: unknown,
): { collabDocUrl: string; joinSecret: string; content?: string } | null {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { collabDocUrl?: unknown }).collabDocUrl !== "string" ||
    typeof (input as { joinSecret?: unknown }).joinSecret !== "string"
  ) {
    return null;
  }
  const content = (input as { content?: unknown }).content;
  return {
    collabDocUrl: (input as { collabDocUrl: string }).collabDocUrl,
    joinSecret: (input as { joinSecret: string }).joinSecret,
    ...(typeof content === "string" ? { content } : {}),
  };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
