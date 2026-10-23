export type NewDocumentRequest =
  | {
      mode: "normal";
    }
  | {
      mode: "coloring";
      coloringPageId: string;
    };

export type StartupNewDocument =
  | "blank"
  | "coloring-picker"
  | { coloringPageId: string };
