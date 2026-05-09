import type { ReadableAtom } from "nanostores";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";

export {
  resolveNearestStrokeWidthOption,
  resolveSelectedColorSwatchIndex,
  TOOLBAR_STROKE_WIDTH_OPTIONS as STROKE_WIDTH_OPTIONS,
} from "../ui/toolbarPresentation";

export interface KidsDrawToolbar {
  readonly el: HTMLDivElement;
  readonly responsiveLayoutOwner: "toolbar";
  bindUiState(state: ReadableAtom<ToolbarUiState>): () => void;
  setCollaborationStatus(status: { visible: boolean; label?: string }): void;
  syncLayout(): void;
  setCanvasContent(content: HTMLElement): void;
  destroy(): void;
}
