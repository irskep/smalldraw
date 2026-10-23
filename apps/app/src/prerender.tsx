import { renderToString } from "preact-render-to-string";

import { PortalFrame } from "./components/PortalFrame";
import { ColoringBookContent } from "./routes/coloringbook.lazy";
import { createAccountWebRuntimeConfig } from "./utils/drawingAppLinks";

// Only public, account-independent content is generated at build time.
export function renderColoringBook(origin: string) {
  return renderToString(
    <PortalFrame>
      <ColoringBookContent
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
