import { expect, test } from "bun:test";

import { createKidsDrawUiIntentController } from "../controller/createKidsDrawUiIntentController";
import type { KidsDrawUiIntent } from "../controller/KidsDrawUiIntent";
import { createToolbarUiPersistence } from "../ui/stores/toolbarUiPersistence";
import { createToolbarUiStore } from "../ui/stores/toolbarUiStore";

test("toddler mode gates tool and navigation commands but allows settings and input", () => {
  const toolbarUiStore = createToolbarUiStore();
  const calls: string[] = [];
  const call = (name: string) => () => {
    calls.push(name);
  };
  const controller = createKidsDrawUiIntentController({
    toolbarUiStore,
    runtime: {
      drawingStore: { updateSharedSettings: call("settings") },
      toolbarStateController: {
        activateFamilyTool: call("tool"),
        activateToolAndRemember: call("variant"),
        randomizeCurrentTool: call("randomize"),
      },
      inputSessionController: {
        handlePointerDown: call("down"),
        handleWorkspacePointerDown: call("outside"),
        handlePointerMove: call("move"),
        handlePointerRawUpdate: call("raw"),
        handlePointerUp: call("up"),
        handlePointerCancel: call("cancel"),
        handleLostPointerCapture: call("capture"),
        forceCancelPointerSession: call("force"),
      },
      cursorOverlay: {
        handlePointerEnter: call("enter"),
        handlePointerLeave: call("leave"),
      },
    },
    commands: {
      toddlerMode: () => toolbarUiStore.setToddlerMode(true),
      exitToddlerMode: call("confirm-exit"),
      scheduleResponsiveLayout: call("resize"),
      undo: call("undo"),
      redo: call("redo"),
      clear: call("clear"),
      export: call("export"),
      newDrawing: call("new"),
      browse: call("browse"),
      share: call("share"),
      parentalControls: call("parental"),
      closeDocumentPicker: call("close"),
    },
  });
  toolbarUiStore.setHasLoadedDocument(true);
  controller.handleUiIntent({ type: "toddler_mode" });
  const blocked: KidsDrawUiIntent[] = [
    { type: "activate_family_tool", familyId: "eraser" },
    { type: "activate_tool_and_remember", toolId: "stamp.cat" },
    ...(
      [
        "randomize",
        "undo",
        "redo",
        "clear",
        "export",
        "new_drawing",
        "browse",
        "share",
        "parental_controls",
      ] as const
    ).map((type) => ({ type })),
  ];
  for (const intent of blocked) controller.handleUiIntent(intent);
  expect(calls).toEqual([]);
  controller.handleUiIntent({
    type: "set_stroke_color",
    strokeColor: "#123456",
  });
  controller.handleUiIntent({ type: "set_stroke_width", strokeWidth: 24 });
  controller.handleUiIntent({
    type: "pointer_workspace_down",
    event: {} as PointerEvent,
  });
  controller.handleUiIntent({ type: "exit_toddler_mode" });
  expect(calls).toEqual(["settings", "settings", "outside", "confirm-exit"]);
  expect(toolbarUiStore.get().toddlerMode).toBe(true);
  toolbarUiStore.setToddlerMode(false);
  controller.handleUiIntent({ type: "undo" });
  expect(calls.at(-1)).toBe("undo");
});

test("mode toggles do not write persisted UI state", () => {
  const toolbarUiStore = createToolbarUiStore();
  const writes: string[] = [];
  const persistence = createToolbarUiPersistence({
    toolbarUiStore,
    getCurrentDocUrl: () => "automerge:toddler",
    seedPersistedSignature: (_, signature) => writes.push(signature),
  });
  persistence.start();
  const initialWrites = writes.length;
  toolbarUiStore.setToddlerMode(true);
  persistence.flush();
  toolbarUiStore.setToddlerMode(false);
  persistence.flush();
  expect(writes).toHaveLength(initialWrites);
});
