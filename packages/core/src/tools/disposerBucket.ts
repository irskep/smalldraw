/**
 * A helper for managing collections of cleanup/disposer functions.
 * Eliminates boilerplate around collecting and calling teardown callbacks.
 */
export interface DisposerBucket {
  /**
   * Add a cleanup function to be called when dispose() is invoked.
   */
  add(disposer: () => void): void;

  /**
   * Call all cleanup functions and clear the collection.
   * Safe to call multiple times.
   */
  dispose(): void;
}

/**
 * Create a new disposer bucket for managing cleanup callbacks.
 *
 * @example
 * const disposers = createDisposerBucket();
 * disposers.add(() => console.log('cleanup 1'));
 * disposers.add(() => console.log('cleanup 2'));
 * disposers.dispose(); // logs both, then clears
 */
export function createDisposerBucket(): DisposerBucket {
  const disposers: Array<() => void> = [];

  const dispose = () => {
    disposers.forEach((d) => d());
    disposers.length = 0;
  };

  return {
    add: (fn: () => void) => disposers.push(fn),
    dispose,
  };
}
