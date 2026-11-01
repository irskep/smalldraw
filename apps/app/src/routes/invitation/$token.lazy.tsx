import { buildDrawingAppUrl } from "@smalldraw/shared";
import { useRoute } from "preact-iso";
import { useEffect } from "preact/hooks";

import { createAccountWebRuntimeConfig } from "@/utils/drawingAppLinks";

export default function Invitation() {
  const { token } = useRoute().params;
  useEffect(() => {
    window.location.replace(
      buildDrawingAppUrl(createAccountWebRuntimeConfig().drawingAppBaseUrl, {
        type: "join",
        joinSecret: token,
      }),
    );
  }, [token]);
  return null;
}
