import { atom } from "nanostores";
import type { KidsDrawUiIntent } from "../KidsDrawUiIntent";

export type UiIntentStore = ReturnType<typeof createUiIntentStore>;

export function createUiIntentStore() {
  const $intents = atom<KidsDrawUiIntent[]>([]);

  return {
    publish(intent: KidsDrawUiIntent): void {
      const current = $intents.get();
      $intents.set([...current, intent]);
    },
    subscribeDrainedIntents(
      listener: (intents: readonly KidsDrawUiIntent[]) => void,
    ): () => void {
      return $intents.subscribe((intents) => {
        if (intents.length === 0) {
          return;
        }
        const drained = [...intents];
        $intents.set([]);
        listener(drained);
      });
    },
  };
}
