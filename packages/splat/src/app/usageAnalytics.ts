import type { DrawingDocument, DrawingStoreActionEvent } from "@smalldraw/core";
import type { UsageAnalytics } from "@smalldraw/shared";

import {
  extractColoringPageId,
  getColoringPageById,
} from "../coloring/catalog";
import type { KidsToolConfig } from "../tools/kidsTools";

export function createDrawingUsageAnalytics(
  analytics: UsageAnalytics | undefined,
  tools: readonly Pick<KidsToolConfig, "id" | "familyId" | "label">[],
) {
  const toolById = new Map(tools.map((tool) => [tool.id, tool]));
  function coloringEvent(kind: "opened" | "started", doc: DrawingDocument) {
    const src = doc.presentation?.referenceImage?.src;
    const id = src ? extractColoringPageId(src) : null;
    const page = id ? getColoringPageById(id) : null;
    if (page)
      analytics?.event(
        `coloring-${kind}/${page.volumeId}/page-${String(page.pageNumber).padStart(3, "0")}`,
        `${kind === "opened" ? "Opened" : "Colored"}: ${page.label}`,
      );
  }
  return {
    opened(doc: DrawingDocument) {
      coloringEvent("opened", doc);
    },
    action(event: DrawingStoreActionEvent, activeToolId: string | null) {
      if (!analytics || event.type !== "apply") return;
      const shapes = event.action
        .affectedShapeIds()
        .map((id) => event.doc.shapes[id])
        .filter(Boolean);
      if (!shapes.length) return;
      // Fill commits asynchronously, possibly after the user selects another tool.
      const tool = toolById.get(
        shapes.some((shape) => shape.type === "raster-fill")
          ? "fill.basic"
          : (activeToolId ?? ""),
      );
      if (!tool) return;
      const stamp =
        tool.familyId === "stamp.images" || tool.familyId === "stamp.alphabet";
      analytics.event(
        `tool-used/${stamp ? tool.familyId : tool.id}`,
        `Used: ${stamp ? (tool.familyId === "stamp.images" ? "Stamps" : "Letters") : tool.label}`,
      );
      if (stamp)
        analytics.event(`stamp-used/${tool.id}`, `Stamp: ${tool.label}`);
      coloringEvent("started", event.doc);
    },
  };
}
