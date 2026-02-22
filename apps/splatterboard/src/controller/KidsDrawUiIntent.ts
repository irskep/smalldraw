export type KidsDrawUiIntent =
  | { type: "window_resize" }
  | { type: "activate_family_tool"; familyId: string }
  | { type: "activate_tool_and_remember"; toolId: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "toggle_mobile_actions" }
  | { type: "set_mobile_top_panel"; panel: "colors" | "strokes" }
  | { type: "clear" }
  | { type: "export" }
  | { type: "new_drawing" }
  | { type: "browse" }
  | { type: "set_stroke_color"; strokeColor: string }
  | { type: "set_stroke_width"; strokeWidth: number }
  | { type: "pointer_down"; event: PointerEvent }
  | { type: "pointer_move"; event: PointerEvent }
  | { type: "pointer_rawupdate"; event: PointerEvent }
  | { type: "pointer_enter"; event: PointerEvent }
  | { type: "pointer_up"; event: PointerEvent }
  | { type: "pointer_cancel"; event: PointerEvent }
  | { type: "lost_pointer_capture" }
  | { type: "pointer_leave" }
  | { type: "force_cancel_pointer_session" }
  | { type: "close_mobile_actions" }
  | { type: "position_mobile_actions_popover" }
  | { type: "close_document_picker" };
