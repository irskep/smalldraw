import { S3Client } from "bun";

export interface DocumentThumbnailStore {
  putObject(input: {
    key: string;
    body: Blob | Uint8Array | ArrayBuffer | string;
    contentType: string;
  }): Promise<void>;
  presignPutUrl(input: {
    key: string;
    contentType: string;
    expiresIn?: number;
  }): string;
}

class R2DocumentThumbnailStore implements DocumentThumbnailStore {
  private readonly client: S3Client;

  constructor() {
    const config = getR2ThumbnailConfig();
    const { accountId, bucket, accessKeyId, secretAccessKey } = config;
    if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        `R2 thumbnail storage is not configured: missing ${config.missing.join(", ")}`,
      );
    }
    this.client = new S3Client({
      bucket,
      accessKeyId,
      secretAccessKey,
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: "auto",
    });
  }

  async putObject(input: {
    key: string;
    body: Blob | Uint8Array | ArrayBuffer | string;
    contentType: string;
  }): Promise<void> {
    await this.client.write(input.key, input.body, {
      type: input.contentType,
    });
  }

  presignPutUrl(input: {
    key: string;
    contentType: string;
    expiresIn?: number;
  }): string {
    return this.client.presign(input.key, {
      method: "PUT",
      expiresIn: input.expiresIn ?? 300,
    });
  }
}

export function getR2ThumbnailConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  const missing = [
    accountId ? null : "R2_ACCOUNT_ID",
    bucket ? null : "R2_BUCKET",
    accessKeyId ? null : "R2_ACCESS_KEY_ID",
    secretAccessKey ? null : "R2_SECRET_ACCESS_KEY",
  ].filter((name): name is string => Boolean(name));
  return {
    accountId,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
    missing,
    ready: missing.length === 0,
  };
}

let documentThumbnailStore: DocumentThumbnailStore | null = null;

export function getDocumentThumbnailStore(): DocumentThumbnailStore {
  if (!documentThumbnailStore) {
    documentThumbnailStore = new R2DocumentThumbnailStore();
  }
  return documentThumbnailStore;
}

export function setDocumentThumbnailStoreForTests(
  store: DocumentThumbnailStore | null,
): void {
  documentThumbnailStore = store;
}
