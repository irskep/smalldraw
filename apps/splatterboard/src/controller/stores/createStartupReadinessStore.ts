import { atom } from "nanostores";

export type StartupPhase =
  | "booting"
  | "doc_loading"
  | "assets_loading"
  | "first_bake"
  | "ready"
  | "degraded";

export interface StartupReadinessState {
  phase: StartupPhase;
  interactionEnabled: boolean;
  assetsTotal: number;
  assetsLoaded: number;
  assetsFailed: number;
  lastBlockingReason?: string;
}

const INITIAL_STATE: StartupReadinessState = {
  phase: "booting",
  interactionEnabled: false,
  assetsTotal: 0,
  assetsLoaded: 0,
  assetsFailed: 0,
  lastBlockingReason: "app_boot",
};

export type StartupReadinessStore = ReturnType<
  typeof createStartupReadinessStore
>;

export function createStartupReadinessStore() {
  const $state = atom<StartupReadinessState>(INITIAL_STATE);

  const setState = (next: StartupReadinessState): void => {
    if (isSameState($state.get(), next)) {
      return;
    }
    $state.set(next);
  };

  const withState = (
    updater: (current: StartupReadinessState) => StartupReadinessState,
  ): void => {
    setState(updater($state.get()));
  };

  return {
    $state,
    subscribe(listener: (state: StartupReadinessState) => void): () => void {
      return $state.subscribe(listener);
    },
    getState(): StartupReadinessState {
      return $state.get();
    },
    startDocLoad(reason = "doc_loading"): void {
      setState({
        phase: "doc_loading",
        interactionEnabled: false,
        assetsTotal: 0,
        assetsLoaded: 0,
        assetsFailed: 0,
        lastBlockingReason: reason,
      });
    },
    setAssetsExpected(total: number): void {
      withState((current) => ({
        ...current,
        phase: "assets_loading",
        assetsTotal: Math.max(0, Math.floor(total)),
        assetsLoaded: 0,
        assetsFailed: 0,
        lastBlockingReason:
          total > 0 ? "awaiting_layer_assets" : current.lastBlockingReason,
      }));
    },
    startFirstBake(): void {
      withState((current) => ({
        ...current,
        phase: "first_bake",
        interactionEnabled: false,
        lastBlockingReason: "awaiting_first_bake",
      }));
    },
    markAssetLoaded(): void {
      withState((current) => ({
        ...current,
        assetsLoaded: Math.min(current.assetsTotal, current.assetsLoaded + 1),
      }));
    },
    markAssetFailed(): void {
      withState((current) => ({
        ...current,
        assetsFailed: Math.min(current.assetsTotal, current.assetsFailed + 1),
      }));
    },
    markReady(): void {
      withState((current) => ({
        ...current,
        phase: "ready",
        interactionEnabled: true,
        lastBlockingReason: undefined,
      }));
    },
    markDegraded(reason: string): void {
      withState((current) => ({
        ...current,
        phase: "degraded",
        interactionEnabled: true,
        lastBlockingReason: reason,
      }));
    },
  };
}

function isSameState(
  a: StartupReadinessState,
  b: StartupReadinessState,
): boolean {
  return (
    a.phase === b.phase &&
    a.interactionEnabled === b.interactionEnabled &&
    a.assetsTotal === b.assetsTotal &&
    a.assetsLoaded === b.assetsLoaded &&
    a.assetsFailed === b.assetsFailed &&
    a.lastBlockingReason === b.lastBlockingReason
  );
}
