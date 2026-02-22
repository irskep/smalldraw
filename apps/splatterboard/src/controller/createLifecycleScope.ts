type Dispose = () => void;

export interface LifecycleScope {
  add(dispose: Dispose): void;
  listen(
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
  ): void;
  disposeAll(): void;
}

export function createLifecycleScope(): LifecycleScope {
  const disposers: Dispose[] = [];

  return {
    add(dispose): void {
      disposers.push(dispose);
    },
    listen(target, type, handler): void {
      const listener: EventListener = (event) => handler(event);
      target.addEventListener(type, listener);
      disposers.push(() => target.removeEventListener(type, listener));
    },
    disposeAll(): void {
      while (disposers.length > 0) {
        const dispose = disposers.pop();
        dispose?.();
      }
    },
  };
}
