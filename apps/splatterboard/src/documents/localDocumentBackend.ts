import type {
  KidsDocumentBackend,
  KidsDocumentCreateInput,
  KidsDocumentMode,
  KidsDocumentSummary,
} from "./types";

const DB_NAME = "kids-draw-documents";
const DB_VERSION = 2;
const DOCUMENTS_STORE = "documents";
const THUMBNAILS_STORE = "thumbnails";
const DEFAULT_CURRENT_DOC_STORAGE_KEY = "kids-draw-doc-url";

type DocumentRecord = KidsDocumentSummary;
type ThumbnailRecord = {
  docUrl: string;
  blob: Blob;
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
  return {
    docUrl: value.docUrl,
    title: value.title,
    mode: normalizeMode(value.mode),
    coloringPageId:
      typeof value.coloringPageId === "string" &&
      value.coloringPageId.length > 0
        ? value.coloringPageId
        : undefined,
    referenceImageSrc:
      typeof value.referenceImageSrc === "string" &&
      value.referenceImageSrc.length > 0
        ? value.referenceImageSrc
        : undefined,
    referenceComposite:
      value.referenceComposite === "under-drawing" ||
      value.referenceComposite === "over-drawing"
        ? value.referenceComposite
        : undefined,
    createdAt: value.createdAt ?? nowIsoString(),
    updatedAt: value.updatedAt ?? nowIsoString(),
    lastOpenedAt: value.lastOpenedAt ?? nowIsoString(),
    thumbnailKey: value.thumbnailKey,
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

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

interface DocumentRepository {
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
        if (!db.objectStoreNames.contains(THUMBNAILS_STORE)) {
          db.createObjectStore(THUMBNAILS_STORE, {
            keyPath: "docUrl",
          });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    IndexedDbConnection.dbPromiseByName.set(this.databaseName, nextPromise);
    return await nextPromise;
  }
}

class IndexedDbDocumentRepository implements DocumentRepository {
  private readonly connection: IndexedDbConnection;

  constructor(connection: IndexedDbConnection) {
    this.connection = connection;
  }

  async listDocuments(): Promise<KidsDocumentSummary[]> {
    const db = await this.connection.getDatabase();
    const transaction = db.transaction(DOCUMENTS_STORE, "readonly");
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const documents = (await toPromise(
      store.getAll(),
    )) as Partial<KidsDocumentSummary>[];
    return sortDocuments(
      documents
        .filter((document) => typeof document.docUrl === "string")
        .map((document) =>
          normalizeDocumentSummary(
            document as Partial<KidsDocumentSummary> &
              Pick<KidsDocumentSummary, "docUrl">,
          ),
        ),
    );
  }

  async getDocument(docUrl: string): Promise<KidsDocumentSummary | null> {
    const db = await this.connection.getDatabase();
    const transaction = db.transaction(DOCUMENTS_STORE, "readonly");
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const document = (await toPromise(store.get(docUrl))) as
      | Partial<KidsDocumentSummary>
      | undefined;
    if (!document || typeof document.docUrl !== "string") {
      return null;
    }
    return normalizeDocumentSummary(
      document as Partial<KidsDocumentSummary> &
        Pick<KidsDocumentSummary, "docUrl">,
    );
  }

  async upsertDocument(
    input: KidsDocumentCreateInput,
  ): Promise<KidsDocumentSummary> {
    const timestamp = nowIsoString();
    const db = await this.connection.getDatabase();
    const transaction = db.transaction(DOCUMENTS_STORE, "readwrite");
    const store = transaction.objectStore(DOCUMENTS_STORE);
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
    const next: DocumentRecord = {
      docUrl: input.docUrl,
      title: input.title ?? existing?.title,
      mode: input.mode ?? existing?.mode ?? "normal",
      coloringPageId:
        input.mode === "normal"
          ? undefined
          : (input.coloringPageId ?? existing?.coloringPageId),
      referenceImageSrc:
        input.mode === "normal"
          ? undefined
          : (input.referenceImageSrc ?? existing?.referenceImageSrc),
      referenceComposite:
        input.mode === "normal"
          ? undefined
          : (input.referenceComposite ?? existing?.referenceComposite),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
      thumbnailKey: existing?.thumbnailKey,
    };
    store.put(next);
    await transactionDone(transaction);
    return next;
  }

  async touchDocument(docUrl: string): Promise<KidsDocumentSummary> {
    const db = await this.connection.getDatabase();
    const transaction = db.transaction(DOCUMENTS_STORE, "readwrite");
    const store = transaction.objectStore(DOCUMENTS_STORE);
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
  }

  async deleteDocument(docUrl: string): Promise<void> {
    const db = await this.connection.getDatabase();
    const transaction = db.transaction(DOCUMENTS_STORE, "readwrite");
    transaction.objectStore(DOCUMENTS_STORE).delete(docUrl);
    await transactionDone(transaction);
  }
}

class MemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, KidsDocumentSummary>();

  async listDocuments(): Promise<KidsDocumentSummary[]> {
    return sortDocuments(Array.from(this.documents.values()));
  }

  async getDocument(docUrl: string): Promise<KidsDocumentSummary | null> {
    return this.documents.get(docUrl) ?? null;
  }

  async upsertDocument(
    input: KidsDocumentCreateInput,
  ): Promise<KidsDocumentSummary> {
    const timestamp = nowIsoString();
    const existing = this.documents.get(input.docUrl);
    const next: KidsDocumentSummary = {
      docUrl: input.docUrl,
      title: input.title ?? existing?.title,
      mode: input.mode ?? existing?.mode ?? "normal",
      coloringPageId:
        input.mode === "normal"
          ? undefined
          : (input.coloringPageId ?? existing?.coloringPageId),
      referenceImageSrc:
        input.mode === "normal"
          ? undefined
          : (input.referenceImageSrc ?? existing?.referenceImageSrc),
      referenceComposite:
        input.mode === "normal"
          ? undefined
          : (input.referenceComposite ?? existing?.referenceComposite),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
      thumbnailKey: existing?.thumbnailKey,
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
    const db = await this.connection.getDatabase();
    const transaction = db.transaction(THUMBNAILS_STORE, "readwrite");
    const store = transaction.objectStore(THUMBNAILS_STORE);
    const thumbnail: ThumbnailRecord = {
      docUrl,
      blob,
      updatedAt: nowIsoString(),
    };
    store.put(thumbnail);
    await transactionDone(transaction);
  }

  async getThumbnail(docUrl: string): Promise<Blob | null> {
    const db = await this.connection.getDatabase();
    const transaction = db.transaction(THUMBNAILS_STORE, "readonly");
    const store = transaction.objectStore(THUMBNAILS_STORE);
    const record = (await toPromise(store.get(docUrl))) as
      | ThumbnailRecord
      | undefined;
    return record?.blob ?? null;
  }

  async deleteThumbnail(docUrl: string): Promise<void> {
    const db = await this.connection.getDatabase();
    const transaction = db.transaction(THUMBNAILS_STORE, "readwrite");
    transaction.objectStore(THUMBNAILS_STORE).delete(docUrl);
    await transactionDone(transaction);
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

  constructor(options: {
    documentRepository: DocumentRepository;
    thumbnailRepository: ThumbnailRepository;
    currentDocumentRepository: CurrentDocumentRepository;
  }) {
    this.documentRepository = options.documentRepository;
    this.thumbnailRepository = options.thumbnailRepository;
    this.currentDocumentRepository = options.currentDocumentRepository;
  }

  async listDocuments(): Promise<KidsDocumentSummary[]> {
    return await this.documentRepository.listDocuments();
  }

  async getDocument(docUrl: string): Promise<KidsDocumentSummary | null> {
    return await this.documentRepository.getDocument(docUrl);
  }

  async createDocument(
    input: KidsDocumentCreateInput,
  ): Promise<KidsDocumentSummary> {
    return await this.documentRepository.upsertDocument(input);
  }

  async touchDocument(docUrl: string): Promise<KidsDocumentSummary | null> {
    return await this.documentRepository.touchDocument(docUrl);
  }

  async deleteDocument(docUrl: string): Promise<void> {
    await this.documentRepository.deleteDocument(docUrl);
    await this.thumbnailRepository.deleteThumbnail(docUrl);
    await this.currentDocumentRepository.clearIfCurrentDocument(docUrl);
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
    await this.currentDocumentRepository.setCurrentDocument(docUrl);
  }

  async getCurrentDocument(): Promise<string | null> {
    return await this.currentDocumentRepository.getCurrentDocument();
  }
}

export function createLocalDocumentBackend(
  options: LocalDocumentBackendOptions = {},
): KidsDocumentBackend {
  const currentDocStorageKey =
    options.currentDocStorageKey ?? DEFAULT_CURRENT_DOC_STORAGE_KEY;
  const databaseName = options.databaseName ?? DB_NAME;
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
    documentRepository: new IndexedDbDocumentRepository(connection),
    thumbnailRepository: new IndexedDbThumbnailRepository(connection),
    currentDocumentRepository,
  });
}
