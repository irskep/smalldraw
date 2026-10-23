import { COLORING_TOPICS, getColoringTopic } from "@smalldraw/shared";
import { renderToString } from "preact-render-to-string";

import { PortalFrame } from "./components/PortalFrame";
import { ColoringBookContent } from "./routes/coloringbook.lazy";
import { createAccountWebRuntimeConfig } from "./utils/drawingAppLinks";

// Only public, account-independent content is generated at build time.
export const coloringBookPaths = [
  "/coloringbook",
  ...COLORING_TOPICS.map((topic) => `/coloringbook/${topic.id}`),
];

export function renderColoringBook(origin: string, pathname = "/coloringbook") {
  return renderToString(
    <PortalFrame>
      <ColoringBookContent
        topic={getColoringTopic(pathname)}
        runtimeConfig={createAccountWebRuntimeConfig(
          {
            VITE_DRAWING_APP_BASE_URL: import.meta.env
              .VITE_DRAWING_APP_BASE_URL,
          },
          new URL(origin),
        )}
      />
    </PortalFrame>,
  );
}
