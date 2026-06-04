import { describe, expect, test } from "bun:test";
import {
  createSplatDocumentNavigationStore,
  resolveNavigationState,
  type SplatDocumentNavigationWindow,
} from "./documentNavigation";

class TestNavigationWindow implements SplatDocumentNavigationWindow {
  readonly location: { href: string };
  readonly history: SplatDocumentNavigationWindow["history"];
  private readonly listeners = new Set<() => void>();

  constructor(href: string) {
    this.location = { href };
    this.history = {
      pushState: (_data, _unused, url) => {
        this.location.href = new URL(
          String(url),
          this.location.href,
        ).toString();
      },
      replaceState: (_data, _unused, url) => {
        this.location.href = new URL(
          String(url),
          this.location.href,
        ).toString();
      },
    };
  }

  addEventListener(type: "popstate", listener: () => void): void {
    if (type === "popstate") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: "popstate", listener: () => void): void {
    if (type === "popstate") {
      this.listeners.delete(listener);
    }
  }

  navigateBackTo(href: string): void {
    this.location.href = href;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

describe("resolveNavigationState", () => {
  test("maps local document URLs to open-document state", () => {
    expect(
      resolveNavigationState(
        "http://localhost:3000/draw/?local=automerge%3Alocal",
      ),
    ).toEqual({
      type: "open-document",
      key: "local:automerge:local",
      docUrl: "automerge:local",
    });
  });

  test("maps account document URLs to catalog-collab document requests", () => {
    expect(
      resolveNavigationState("http://localhost:3000/draw/?doc=server-doc"),
    ).toEqual({
      type: "open-document",
      key: "account:server-doc",
      docUrl: "catalog-collab:server-doc",
    });
  });

  test("keeps share-link startup as bootstrap-only navigation state", () => {
    expect(
      resolveNavigationState("http://localhost:3000/draw/?join=invite"),
    ).toEqual({
      type: "none",
      key: "share:invite",
    });
  });

  test("represents invalid URLs as state instead of throwing", () => {
    expect(
      resolveNavigationState("http://localhost:3000/draw/?doc=one&local=two"),
    ).toEqual({
      type: "startup-error",
      key: "error:Open only one drawing URL at a time.",
      message: "Open only one drawing URL at a time.",
    });
  });
});

describe("createSplatDocumentNavigationStore", () => {
  test("pushDocument mutates history and publishes the URL-derived state", () => {
    const window = new TestNavigationWindow("http://localhost:3000/draw/");
    const store = createSplatDocumentNavigationStore({
      window,
    });
    const states = [store.get()];
    const unbind = store.subscribe((state) => {
      states.push(state);
    });

    store.pushDocument(
      {
        docUrl: "catalog-collab:server-doc",
        collaborative: true,
        collabDocUrl: "automerge:server-doc",
        accountAttached: true,
      },
      "catalog-collab:server-doc",
    );

    expect(window.location.href).toBe(
      "http://localhost:3000/draw/?doc=server-doc",
    );
    expect(states.at(-1)).toEqual({
      type: "open-document",
      key: "account:server-doc",
      docUrl: "catalog-collab:server-doc",
    });

    unbind();
    store.dispose();
  });

  test("replaceCurrentDocument records the loaded document without adding history", () => {
    const window = new TestNavigationWindow(
      "http://localhost:3000/draw/?doc=old",
    );
    const store = createSplatDocumentNavigationStore({
      window,
    });

    store.replaceCurrentDocument({
      docUrl: "automerge:local",
    });

    expect(window.location.href).toBe(
      "http://localhost:3000/draw/?local=automerge%3Alocal",
    );
    expect(store.get()).toEqual({
      type: "open-document",
      key: "local:automerge:local",
      docUrl: "automerge:local",
    });

    store.dispose();
  });

  test("popstate publishes document requests from browser history", () => {
    const window = new TestNavigationWindow(
      "http://localhost:3000/draw/?doc=one",
    );
    const store = createSplatDocumentNavigationStore({ window });
    const states = [store.get()];
    const unbind = store.subscribe((state) => {
      states.push(state);
    });

    window.navigateBackTo("http://localhost:3000/draw/?local=automerge%3Atwo");

    expect(states.at(-1)).toEqual({
      type: "open-document",
      key: "local:automerge:two",
      docUrl: "automerge:two",
    });

    unbind();
    store.dispose();
  });
});
