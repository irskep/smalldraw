export {
  automergeUrlToDocumentId,
  isCollaborativeDocument,
  resolveDocumentOpenUrl,
} from "./collaboration";
export {
  type CollaborativeDocumentIndex,
  createCollaborativeDocumentIndex,
} from "./collaborativeDocumentIndex";
export {
  type CreateLocalSmalldrawRepoOptions,
  createLocalSmalldrawRepo,
} from "./createLocalSmalldrawRepo";
export {
  createLocalDocumentBackend,
  type LocalDocumentBackendOptions,
} from "./localDocumentBackend";
export { createServerAnnouncePolicy } from "./repoSharePolicy";
export type {
  KidsDocumentBackend,
  KidsDocumentCreateInput,
  KidsDocumentMode,
  KidsDocumentSummary,
} from "./types";
