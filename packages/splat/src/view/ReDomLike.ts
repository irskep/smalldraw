export type ReDomLike<TElement extends Element = Element, TData = unknown> = {
  readonly el: TElement;
  update?: (
    data: TData,
    index?: number,
    items?: unknown[],
    context?: unknown,
  ) => void;
  onmount?: () => void;
  onunmount?: () => void;
};
