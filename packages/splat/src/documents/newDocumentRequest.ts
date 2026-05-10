export type NewDocumentRequest =
  | {
      mode: "normal";
    }
  | {
      mode: "coloring";
      coloringPageId: string;
    };
