import type { ReadableAtom } from "nanostores";

type ListViewLike<TItem> = {
  update(items: readonly TItem[]): void;
};

type AttrValue = string | number | boolean | null | undefined;

export function bindAtom<TValue>(
  store: ReadableAtom<TValue>,
  apply: (value: TValue) => void,
): () => void {
  apply(store.get());
  return store.subscribe((value) => {
    apply(value);
  });
}

export function bindList<TItem>(
  store: ReadableAtom<readonly TItem[]>,
  listView: ListViewLike<TItem>,
  key: (item: TItem) => string,
): () => void {
  return bindAtom(store, (items) => {
    // Guard against key collisions early, because list identity depends on unique keys.
    const seen = new Set<string>();
    for (const item of items) {
      const itemKey = key(item);
      if (seen.has(itemKey)) {
        throw new Error(`bindList duplicate key "${itemKey}"`);
      }
      seen.add(itemKey);
    }
    listView.update(items);
  });
}

export function bindAttrs<TValue>(
  store: ReadableAtom<TValue>,
  element: HTMLElement,
  projector: (value: TValue) => Record<string, AttrValue>,
): () => void {
  let previous: Record<string, AttrValue> = {};
  return bindAtom(store, (value) => {
    const next = projector(value);
    for (const key of Object.keys(previous)) {
      if (!(key in next)) {
        unsetAttrOrProp(element, key, previous[key]);
      }
    }
    for (const [key, attrValue] of Object.entries(next)) {
      setAttrOrProp(element, key, attrValue);
    }
    previous = next;
  });
}

function setAttrOrProp(
  element: HTMLElement,
  key: string,
  value: AttrValue,
): void {
  if (key in element) {
    (element as unknown as Record<string, unknown>)[key] =
      value === null || value === undefined ? false : value;
    return;
  }
  if (value === null || value === undefined || value === false) {
    element.removeAttribute(key);
    return;
  }
  if (value === true) {
    element.setAttribute(key, "");
    return;
  }
  element.setAttribute(key, `${value}`);
}

function unsetAttrOrProp(
  element: HTMLElement,
  key: string,
  previousValue: AttrValue,
): void {
  if (key in element) {
    if (typeof previousValue === "string") {
      (element as unknown as Record<string, unknown>)[key] = "";
      return;
    }
    (element as unknown as Record<string, unknown>)[key] = false;
    return;
  }
  element.removeAttribute(key);
}
