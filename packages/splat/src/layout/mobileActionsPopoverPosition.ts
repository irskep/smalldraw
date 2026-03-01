export type MobileActionsPopoverPositionInput = {
  triggerRect: DOMRect;
  popoverRect: DOMRect;
  viewportWidth: number;
  viewportHeight: number;
  viewportPaddingPx: number;
  gapPx: number;
};

export function resolveMobileActionsPopoverPosition(
  input: MobileActionsPopoverPositionInput,
): {
  left: number;
  top: number;
} {
  const minLeft = input.viewportPaddingPx;
  const maxLeft =
    input.viewportWidth - input.viewportPaddingPx - input.popoverRect.width;
  const left = Math.max(
    minLeft,
    Math.min(input.triggerRect.right - input.popoverRect.width, maxLeft),
  );
  const belowTop = input.triggerRect.bottom + input.gapPx;
  const aboveTop =
    input.triggerRect.top - input.gapPx - input.popoverRect.height;
  const canPlaceAbove = aboveTop >= input.viewportPaddingPx;
  const wouldOverflowBottom =
    belowTop + input.popoverRect.height >
    input.viewportHeight - input.viewportPaddingPx;
  const top =
    wouldOverflowBottom && canPlaceAbove
      ? aboveTop
      : Math.max(
          input.viewportPaddingPx,
          Math.min(
            belowTop,
            input.viewportHeight -
              input.viewportPaddingPx -
              input.popoverRect.height,
          ),
        );
  return { left, top };
}
