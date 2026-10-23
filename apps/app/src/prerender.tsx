import { LocationProvider } from "preact-iso";
import { renderToString } from "preact-render-to-string";

import { PortalLayout } from "./routes/__root";
import { ColoringBookContent } from "./routes/coloringbook.lazy";
import { createAccountWebRuntimeConfig } from "./utils/drawingAppLinks";

// Only public, account-independent content is generated at build time.
export function renderColoringBook(origin: string, pathname: string) {
  return renderToString(
    <LocationProvider.ctx.Provider
      value={{
        url: pathname,
        path: pathname,
        query: {},
        route: () => {},
        back: () => {},
        forward: () => {},
      }}
    >
      <PortalLayout>
        <ColoringBookContent
          runtimeConfig={createAccountWebRuntimeConfig(
            {
              VITE_DRAWING_APP_BASE_URL: import.meta.env
                .VITE_DRAWING_APP_BASE_URL,
            },
            new URL(origin),
          )}
        />
      </PortalLayout>
    </LocationProvider.ctx.Provider>,
  );
}
