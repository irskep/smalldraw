import { appPath } from "../config";
import {
  getDrawingWorkspace,
  createMultiplayerApiClient,
  prepareAccountWorkspace,
  signOutAccountWorkspace,
  watchAccountWorkspace,
} from "@smalldraw/splat/account";
import {
  createLocalDocumentBackend,
  createLocalSmalldrawRepo,
} from "@smalldraw/splat/documents";

const api = createMultiplayerApiClient({
  apiUrl: import.meta.env.VITE_API_URL,
});
let watcher: ReturnType<typeof watchAccountWorkspace> | undefined;
let pending: Promise<void> | undefined;
export function initializeAccountWorkspace(): Promise<void> {
  return (pending ??= (async () => {
    await prepareAccountWorkspace(api);
    watcher = watchAccountWorkspace({
      api,
      repo: getDrawingWorkspace() ? await createAccountRepo() : undefined,
      backend: createLocalDocumentBackend(),
      onSignedOut: () => window.location.assign(appPath("")),
      beforeFreeze: async () => {
        document.querySelector("main")!.inert = true;
      },
    });
  })());
}
export async function signOutWorkspace() {
  await initializeAccountWorkspace();
  await signOutAccountWorkspace(api, () => watcher!.freeze());
}

async function createAccountRepo() {
  const { initAutomerge } = await import("@smalldraw/core");
  await initAutomerge();
  return createLocalSmalldrawRepo();
}
