import type {
  AccountCheckpoint,
  KidsDocumentBackend,
  KidsDocumentCreateInput,
  KidsDocumentMode,
  KidsDocumentSummary,
} from "./types";
import { getDrawingWorkspace, workspaceNames } from "./workspace";

const DB_VERSION = 3;
const DOCUMENTS_STORE = "documents";
const THUMBNAILS_STORE = "thumbnails";

type DocumentRecord = KidsDocumentSummary;
type ThumbnailRecord = {
  docUrl: string;
  bytes: ArrayBuffer;
  mimeType: string;
  updatedAt: string;
};

export interface LocalDocumentBackendOptions {
  currentDocStorageKey?: string;
  databaseName?: string;
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function normalizeMode(mode: unknown): KidsDocumentMode {
  if (mode === "coloring" || mode === "markup") {
    return mode;
  }
  return "normal";
}

function normalizeDocumentSummary(
  value: Partial<KidsDocumentSummary> & Pick<KidsDocumentSummary, "docUrl">,
): KidsDocumentSummary {
  const collabDocUrl =
    typeof value.collabDocUrl === "string" && value.collabDocUrl.length > 0
      ? value.collabDocUrl
      : undefined;
  const joinSecret =
    typeof value.joinSecret === "string" && value.joinSecret.length > 0
      ? value.joinSecret
      : undefined;
  const accessToken =
    typeof value.accessToken === "string" && value.accessToken.length > 0
      ? value.accessToken
      : undefined;
  const accessTokenScope =
    value.accessTokenScope === "owner" || value.accessTokenScope === "device"
      ? value.accessTokenScope
      : undefined;
  const collaborative = Boolean(value.collaborative || collabDocUrl);
  const coloringPageId =
    typeof value.coloringPageId === "string" && value.coloringPageId.length > 0
      ? value.coloringPageId
      : undefined;
  return {
    docUrl: value.docUrl,
    accountCheckpoint: value.accountCheckpoint,
    collaborative,
    collabDocUrl: collaborative ? collabDocUrl : undefined,
    joinSecret: collaborative ? joinSecret : undefined,
    accessToken: collaborative ? accessToken : undefined,
    accessTokenScope: collaborative ? accessTokenScope : undefined,
    accountAttached: value.accountAttached === true ? true : undefined,
    canDeleteFromServer:
      collaborative && value.canDeleteFromServer === true ? true : undefined,
    accountSyncPending:
      value.accountSyncPending === true && !collaborative ? true : undefined,
    accountSyncLastAttemptAt:
      typeof value.accountSyncLastAttemptAt === "string"
        ? value.accountSyncLastAttemptAt
        : undefined,
    title: value.title,
    mode: normalizeMode(value.mode),
    coloringPageId,
    referenceImageSrc: undefined,
    referenceComposite:
      value.referenceComposite === "under-drawing" ||
      value.referenceComposite === "over-drawing"
        ? value.referenceComposite
        : undefined,
    createdAt: value.createdAt ?? nowIsoString(),
    updatedAt: value.updatedAt ?? nowIsoString(),
    lastOpenedAt: value.lastOpenedAt ?? nowIsoString(),
    thumbnailKey: value.thumbnailKey,
    remoteThumbnailUrl:
      typeof value.remoteThumbnailUrl === "string" &&
      value.remoteThumbnailUrl.length > 0
        ? value.remoteThumbnailUrl
        : undefined,
  };
}

function sortDocuments(
  documents: KidsDocumentSummary[],
): KidsDocumentSummary[] {
  return [...documents].sort((a, b) => {
    const lastOpenedDelta =
      Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt);
    if (lastOpenedDelta !== 0) {
      return lastOpenedDelta;
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

function dedupeDocumentSummaries(
  documents: KidsDocumentSummary[],
): KidsDocumentSummary[] {
  const catalogDocUrlByCollabDocUrl = new Map<string, string>();
  for (const document of documents) {
    if (document.collabDocUrl && document.docUrl !== document.collabDocUrl) {
      catalogDocUrlByCollabDocUrl.set(document.collabDocUrl, document.docUrl);
    }
  }

  return documents.filter((document) => {
    if (document.docUrl.startsWith("catalog-collab:")) {
      return true;
    }
    if (!document.collabDocUrl) {
      return !catalogDocUrlByCollabDocUrl.has(document.docUrl);
    }
    const catalogDocUrl = catalogDocUrlByCollabDocUrl.get(
      document.collabDocUrl,
    );
    return !catalogDocUrl || catalogDocUrl === document.docUrl;
  });
}

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => {
      const request = event.target as IDBRequest;
      reject(
        request.error ??
          transaction.error ??
          new Error("IndexedDB transaction failed"),
      );
    };
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

interface DocumentRepository {
  saveAccountCheckpoint(
    docUrl: string,
    checkpoint: AccountCheckpoint,
  ): Promise<void>;
  listDocuments(): Promise<KidsDocumentSummary[]>;
  getDocument(docUrl: string): Promise<KidsDocumentSummary | null>;
  upsertDocument(input: KidsDocumentCreateInput): Promise<KidsDocumentSummary>;
  touchDocument(docUrl: string): Promise<KidsDocumentSummary>;
  deleteDocument(docUrl: string): Promise<void>;
}

interface ThumbnailRepository {
  saveThumbnail(docUrl: string, blob: Blob): Promise<void>;
  getThumbnail(docUrl: string): Promise<Blob | null>;
  deleteThumbnail(docUrl: string): Promise<void>;
}

interface CurrentDocumentRepository {
  setCurrentDocument(docUrl: string): Promise<void>;
  getCurrentDocument(): Promise<string | null>;
  clearIfCurrentDocument(docUrl: string): Promise<void>;
}

class IndexedDbConnection {
  private static readonly dbPromiseByName = new Map<
    string,
    Promise<IDBDatabase>
  >();
  readonly databaseName: string;

  constructor(databaseName: string) {
    this.databaseName = databaseName;
  }

  private clearCachedDatabase(): void {
    IndexedDbConnection.dbPromiseByName.delete(this.databaseName);
  }

  private bindLifetimeHandlers(db: IDBDatabase): void {
    db.onclose = () => {
      this.clearCachedDatabase();
    };
    db.onversionchange = () => {
      this.clearCachedDatabase();
      db.close();
    };
  }

  private isRecoverableStateError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "InvalidStateError";
  }

  async getDatabase(): Promise<IDBDatabase> {
    const existingPromise = IndexedDbConnection.dbPromiseByName.get(
      this.databaseName,
    );
    if (existingPromise) {
      return await existingPromise;
    }

    const nextPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
          db.createObjectStore(DOCUMENTS_STORE, {
            keyPath: "docUrl",
          });
        }
        // Thumbnails are regenerable cache entries; discard the old Blob format.
        if (db.objectStoreNames.contains(THUMBNAILS_STORE)) {
          db.deleteObjectStore(THUMBNAILS_STORE);
        }
        db.createObjectStore(THUMBNAILS_STORE, {
          keyPath: "docUrl",
        });
      };
      request.onsuccess = () => {
        const db = request.result;
        this.bindLifetimeHandlers(db);
        resolve(db);
      };
      request.onerror = () => {
        this.clearCachedDatabase();
        reject(request.error);
      };
      request.onblocked = () => {
        this.clearCachedDatabase();
      };
    });

    IndexedDbConnection.dbPromiseByName.set(this.databaseName, nextPromise);
    return await nextPromise;
  }

  async runTransaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (
      store: IDBObjectStore,
      transaction: IDBTransaction,
    ) => Promise<T>,
  ): Promise<T> {
    return await this.runTransactionAttempt(storeName, mode, callback, true);
  }

  private async runTransactionAttempt<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (
      store: IDBObjectStore,
      transaction: IDBTransaction,
    ) => Promise<T>,
    canRetry: boolean,
  ): Promise<T> {
    const db = await this.getDatabase();
    try {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      return await callback(store, transaction);
    } catch (error) {
      if (!canRetry || !this.isRecoverableStateError(error)) {
        throw error;
      }
      this.clearCachedDatabase();
      return await this.runTransactionAttempt(storeName, mode, callback, false);
    }
  }
}

class IndexedDbDocumentRepository implements DocumentRepository {
  private readonly connection: IndexedDbConnection;

  constructor(connection: IndexedDbConnection) {
    this.connection = connection;
  }

  async listDocuments(): Promise<KidsDocumentSummary[]> {
    const documents = (await this.connection.runTransaction(
      DOCUMENTS_STORE,
      "readonly",
      async (store) => {
        return (await toPromise(
          store.getAll(),
        )) as Partial<KidsDocumentSummary>[];
      },
    )) as Partial<KidsDocumentSummary>[];
    return sortDocuments(
      dedupeDocumentSummaries(
        documents
          .filter((document) => typeof document.docUrl === "string")
          .map((document) =>
            normalizeDocumentSummary(
              document as Partial<KidsDocumentSummary> &
                Pick<KidsDocumentSummary, "docUrl">,
            ),
          ),
      ),
    );
  }

  async getDocument(docUrl: string): Promise<KidsDocumentSummary | null> {
    const document = (await this.connection.runTransaction(
      DOCUMENTS_STORE,
      "readonly",
      async (store) => {
        return (await toPromise(store.get(docUrl))) as
          | Partial<KidsDocumentSummary>
          | undefined;
      },
    )) as Partial<KidsDocumentSummary> | undefined;
    if (!document || typeof document.docUrl !== "string") {
      return null;
    }
    return normalizeDocumentSummary(
      document as Partial<KidsDocumentSummary> &
        Pick<KidsDocumentSummary, "docUrl">,
    );
  }

  async saveAccountCheckpoint(
    docUrl: string,
    checkpoint: AccountCheckpoint,
  ): Promise<void> {
    await this.connection.runTransaction(
      DOCUMENTS_STORE,
      "readwrite",
      async (store, transaction) => {
        const existing = (await toPromise(store.get(docUrl))) as
          | DocumentRecord
          | undefined;
        // A checkpoint must not resurrect a drawing deleted while the request was in flight.
        if (existing) store.put({ ...existing, accountCheckpoint: checkpoint });
        await transactionDone(transaction);
      },
    );
  }

  async upsertDocument(
    input: KidsDocumentCreateInput,
  ): Promise<KidsDocumentSummary> {
    const timestamp = nowIsoString();
    return await this.connection.runTransaction(
      DOCUMENTS_STORE,
      "readwrite",
      async (store, transaction) => {
        const existingRaw = (await toPromise(store.get(input.docUrl))) as
          | Partial<DocumentRecord>
          | undefined;
        const existing =
          existingRaw && typeof existingRaw.docUrl === "string"
            ? normalizeDocumentSummary(
                existingRaw as Partial<KidsDocumentSummary> &
                  Pick<KidsDocumentSummary, "docUrl">,
              )
            : undefined;
        const requestedCollaborative =
          input.collaborative ?? existing?.collaborative;
        const nextCollabDocUrl =
          requestedCollaborative === false
            ? undefined
            : (input.collabDocUrl ?? existing?.collabDocUrl);
        const collaborative = Boolean(
          requestedCollaborative && nextCollabDocUrl,
        );
        const next: DocumentRecord = {
          docUrl: input.docUrl,
          collaborative,
          collabDocUrl: collaborative ? nextCollabDocUrl : undefined,
          joinSecret:
            collaborative === false
              ? undefined
              : (input.joinSecret ?? existing?.joinSecret),
          accessToken:
            collaborative === false
              ? undefined
              : (input.accessToken ?? existing?.accessToken),
          accessTokenScope:
            collaborative === false
              ? undefined
              : (input.accessTokenScope ?? existing?.accessTokenScope),
          accountAttached: input.accountAttached ?? existing?.accountAttached,
          accountCheckpoint: existing?.accountCheckpoint,
          canDeleteFromServer:
            input.canDeleteFromServer ?? existing?.canDeleteFromServer,
          accountSyncPending: collaborative
            ? undefined
            : (input.accountSyncPending ?? existing?.accountSyncPending),
          accountSyncLastAttemptAt: collaborative
            ? undefined
            : (input.accountSyncLastAttemptAt ??
              existing?.accountSyncLastAttemptAt),
          title: input.title ?? existing?.title,
          mode: input.mode ?? existing?.mode ?? "normal",
          coloringPageId:
            input.mode === "normal"
              ? undefined
              : (input.coloringPageId ?? existing?.coloringPageId),
          referenceImageSrc: undefined,
          referenceComposite:
            input.mode === "normal"
              ? undefined
              : (input.referenceComposite ?? existing?.referenceComposite),
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
          lastOpenedAt: timestamp,
          thumbnailKey: existing?.thumbnailKey,
          remoteThumbnailUrl:
            input.remoteThumbnailUrl ?? existing?.remoteThumbnailUrl,
        };
        store.put(next);
        await transactionDone(transaction);
        return next;
      },
    );
  }

  async touchDocument(docUrl: string): Promise<KidsDocumentSummary> {
    return await this.connection.runTransaction(
      DOCUMENTS_STORE,
      "readwrite",
      async (store, transaction) => {
        const existingRaw = (await toPromise(store.get(docUrl))) as
          | Partial<KidsDocumentSummary>
          | undefined;
        const existing =
          existingRaw && typeof existingRaw.docUrl === "string"
            ? normalizeDocumentSummary(
                existingRaw as Partial<KidsDocumentSummary> &
                  Pick<KidsDocumentSummary, "docUrl">,
              )
            : undefined;
        const timestamp = nowIsoString();
        const next: KidsDocumentSummary = existing
          ? {
              ...existing,
              updatedAt: timestamp,
              lastOpenedAt: timestamp,
            }
          : {
              docUrl,
              mode: "normal",
              createdAt: timestamp,
              updatedAt: timestamp,
              lastOpenedAt: timestamp,
            };
        store.put(next);
        await transactionDone(transaction);
        return next;
      },
    );
  }

  async deleteDocument(docUrl: string): Promise<void> {
    await this.connection.runTransaction(
      DOCUMENTS_STORE,
      "readwrite",
      async (store, transaction) => {
        store.delete(docUrl);
        await transactionDone(transaction);
      },
    );
  }
}

class MemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, KidsDocumentSummary>();

  async listDocuments(): Promise<KidsDocumentSummary[]> {
    return sortDocuments(
      dedupeDocumentSummaries(Array.from(this.documents.values())),
    );
  }

  async getDocument(docUrl: string): Promise<KidsDocumentSummary | null> {
    return this.documents.get(docUrl) ?? null;
  }

  async saveAccountCheckpoint(
    docUrl: string,
    checkpoint: AccountCheckpoint,
  ): Promise<void> {
    const existing = this.documents.get(docUrl);
    if (existing)
      this.documents.set(docUrl, {
        ...existing,
        accountCheckpoint: structuredClone(checkpoint),
      });
  }

  async upsertDocument(
    input: KidsDocumentCreateInput,
  ): Promise<KidsDocumentSummary> {
    const timestamp = nowIsoString();
    const existing = this.documents.get(input.docUrl);
    const requestedCollaborative =
      input.collaborative ?? existing?.collaborative;
    const nextCollabDocUrl =
      requestedCollaborative === false
        ? undefined
        : (input.collabDocUrl ?? existing?.collabDocUrl);
    const collaborative = Boolean(requestedCollaborative && nextCollabDocUrl);
    const next: KidsDocumentSummary = {
      docUrl: input.docUrl,
      collaborative,
      collabDocUrl: collaborative ? nextCollabDocUrl : undefined,
      joinSecret:
        collaborative === false
          ? undefined
          : (input.joinSecret ?? existing?.joinSecret),
      accessToken:
        collaborative === false
          ? undefined
          : (input.accessToken ?? existing?.accessToken),
      accessTokenScope:
        collaborative === false
          ? undefined
          : (input.accessTokenScope ?? existing?.accessTokenScope),
      accountAttached: input.accountAttached ?? existing?.accountAttached,
      accountCheckpoint: existing?.accountCheckpoint,
      canDeleteFromServer:
        input.canDeleteFromServer ?? existing?.canDeleteFromServer,
      title: input.title ?? existing?.title,
      mode: input.mode ?? existing?.mode ?? "normal",
      coloringPageId:
        input.mode === "normal"
          ? undefined
          : (input.coloringPageId ?? existing?.coloringPageId),
      referenceImageSrc: undefined,
      referenceComposite:
        input.mode === "normal"
          ? undefined
          : (input.referenceComposite ?? existing?.referenceComposite),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
      thumbnailKey: existing?.thumbnailKey,
      remoteThumbnailUrl:
        input.remoteThumbnailUrl ?? existing?.remoteThumbnailUrl,
    };
    this.documents.set(input.docUrl, next);
    return next;
  }

  async touchDocument(docUrl: string): Promise<KidsDocumentSummary> {
    const existing = this.documents.get(docUrl);
    if (!existing) {
      return await this.upsertDocument({ docUrl });
    }
    const timestamp = nowIsoString();
    const next: KidsDocumentSummary = {
      ...existing,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    };
    this.documents.set(docUrl, next);
    return next;
  }

  async deleteDocument(docUrl: string): Promise<void> {
    this.documents.delete(docUrl);
  }
}

class IndexedDbThumbnailRepository implements ThumbnailRepository {
  private readonly connection: IndexedDbConnection;

  constructor(connection: IndexedDbConnection) {
    this.connection = connection;
  }

  async saveThumbnail(docUrl: string, blob: Blob): Promise<void> {
    // Safari private browsing cannot persist Blob values in IndexedDB.
    // Read bytes before opening the transaction so it cannot expire while waiting.
    const bytes = await blob.arrayBuffer();
    await this.connection.runTransaction(
      THUMBNAILS_STORE,
      "readwrite",
      async (store, transaction) => {
        const thumbnail: ThumbnailRecord = {
          docUrl,
          bytes,
          mimeType: blob.type,
          updatedAt: nowIsoString(),
        };
        store.put(thumbnail);
        await transactionDone(transaction);
      },
    );
  }

  async getThumbnail(docUrl: string): Promise<Blob | null> {
    const record = (await this.connection.runTransaction(
      THUMBNAILS_STORE,
      "readonly",
      async (store) => {
        return (await toPromise(store.get(docUrl))) as
          | ThumbnailRecord
          | undefined;
      },
    )) as ThumbnailRecord | undefined;
    return record ? new Blob([record.bytes], { type: record.mimeType }) : null;
  }

  async deleteThumbnail(docUrl: string): Promise<void> {
    await this.connection.runTransaction(
      THUMBNAILS_STORE,
      "readwrite",
      async (store, transaction) => {
        store.delete(docUrl);
        await transactionDone(transaction);
      },
    );
  }
}

class MemoryThumbnailRepository implements ThumbnailRepository {
  private readonly thumbnails = new Map<string, Blob>();

  async saveThumbnail(docUrl: string, blob: Blob): Promise<void> {
    this.thumbnails.set(docUrl, blob);
  }

  async getThumbnail(docUrl: string): Promise<Blob | null> {
    return this.thumbnails.get(docUrl) ?? null;
  }

  async deleteThumbnail(docUrl: string): Promise<void> {
    this.thumbnails.delete(docUrl);
  }
}

class LocalStorageCurrentDocumentRepository
  implements CurrentDocumentRepository
{
  private readonly storageKey: string;
  private memoryCurrentDocument: string | null = null;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  private hasStorage(): boolean {
    return typeof localStorage !== "undefined";
  }

  async setCurrentDocument(docUrl: string): Promise<void> {
    if (this.hasStorage()) {
      localStorage.setItem(this.storageKey, docUrl);
      return;
    }
    this.memoryCurrentDocument = docUrl;
  }

  async getCurrentDocument(): Promise<string | null> {
    if (this.hasStorage()) {
      return localStorage.getItem(this.storageKey);
    }
    return this.memoryCurrentDocument;
  }

  async clearIfCurrentDocument(docUrl: string): Promise<void> {
    const currentDocument = await this.getCurrentDocument();
    if (currentDocument !== docUrl) {
      return;
    }
    if (this.hasStorage()) {
      localStorage.removeItem(this.storageKey);
      return;
    }
    this.memoryCurrentDocument = null;
  }
}

class LocalDocumentBackend implements KidsDocumentBackend {
  readonly mode = "local" as const;
  private readonly documentRepository: DocumentRepository;
  private readonly thumbnailRepository: ThumbnailRepository;
  private readonly currentDocumentRepository: CurrentDocumentRepository;

  private readonly hideAccountCaches: boolean;

  constructor(options: {
    hideAccountCaches?: boolean;
    documentRepository: DocumentRepository;
    thumbnailRepository: ThumbnailRepository;
    currentDocumentRepository: CurrentDocumentRepository;
  }) {
    this.hideAccountCaches = options.hideAccountCaches ?? false;
    this.documentRepository = options.documentRepository;
    this.thumbnailRepository = options.thumbnailRepository;
    this.currentDocumentRepository = options.currentDocumentRepository;
  }

  async listDocuments(): Promise<KidsDocumentSummary[]> {
    const documents = await this.documentRepository.listDocuments();
    return this.hideAccountCaches
      ? documents.filter((document) => !document.accountAttached)
      : documents;
  }

  async getDocument(docUrl: string): Promise<KidsDocumentSummary | null> {
    const document = await this.documentRepository.getDocument(docUrl);
    return this.hideAccountCaches && document?.accountAttached
      ? null
      : document;
  }

  async saveAccountCheckpoint(
    docUrl: string,
    checkpoint: AccountCheckpoint,
  ): Promise<void> {
    await this.documentRepository.saveAccountCheckpoint(docUrl, checkpoint);
  }

  async createDocument(
    input: KidsDocumentCreateInput,
  ): Promise<KidsDocumentSummary> {
    const document = await this.documentRepository.upsertDocument(input);
    if (typeof window !== "undefined")
      window.dispatchEvent(new window.Event("drawing-catalog-change"));
    return document;
  }

  async touchDocument(docUrl: string): Promise<KidsDocumentSummary | null> {
    return await this.documentRepository.touchDocument(docUrl);
  }

  async deleteDocument(docUrl: string): Promise<void> {
    await this.documentRepository.deleteDocument(docUrl);
    await this.thumbnailRepository.deleteThumbnail(docUrl);
    await this.currentDocumentRepository.clearIfCurrentDocument(docUrl);
    if (typeof window !== "undefined")
      window.dispatchEvent(new window.Event("drawing-catalog-change"));
  }

  async saveThumbnail(docUrl: string, blob: Blob): Promise<void> {
    await this.thumbnailRepository.saveThumbnail(docUrl, blob);
    console.info("[kids-draw:documents] thumbnail saved", {
      docUrl,
      type: blob.type || "application/octet-stream",
      sizeBytes: blob.size,
    });
  }

  async getThumbnail(docUrl: string): Promise<Blob | null> {
    return await this.thumbnailRepository.getThumbnail(docUrl);
  }

  async setCurrentDocument(docUrl: string): Promise<void> {
    const persisted = await this.documentRepository.getDocument(docUrl);
    if (persisted) {
      await this.currentDocumentRepository.setCurrentDocument(persisted.docUrl);
      return;
    }

    const documents = await this.documentRepository.listDocuments();
    const byCollabUrl = documents.find((document) => {
      return document.collaborative && document.collabDocUrl === docUrl;
    });
    await this.currentDocumentRepository.setCurrentDocument(
      byCollabUrl?.docUrl ?? docUrl,
    );
  }

  async getCurrentDocument(): Promise<string | null> {
    const docUrl = await this.currentDocumentRepository.getCurrentDocument();
    return this.hideAccountCaches && docUrl && !(await this.getDocument(docUrl))
      ? null
      : docUrl;
  }
}

export function createLocalDocumentBackend(
  options: LocalDocumentBackendOptions = {},
): KidsDocumentBackend {
  const currentDocStorageKey =
    options.currentDocStorageKey ?? workspaceNames().current;
  const databaseName = options.databaseName ?? workspaceNames().catalog;
  const currentDocumentRepository = new LocalStorageCurrentDocumentRepository(
    currentDocStorageKey,
  );

  if (typeof indexedDB === "undefined") {
    return new LocalDocumentBackend({
      documentRepository: new MemoryDocumentRepository(),
      thumbnailRepository: new MemoryThumbnailRepository(),
      currentDocumentRepository,
    });
  }

  const connection = new IndexedDbConnection(databaseName);
  return new LocalDocumentBackend({
    hideAccountCaches:
      options.databaseName === undefined && getDrawingWorkspace() === null,
    documentRepository: new IndexedDbDocumentRepository(connection),
    thumbnailRepository: new IndexedDbThumbnailRepository(connection),
    currentDocumentRepository,
  });
}
