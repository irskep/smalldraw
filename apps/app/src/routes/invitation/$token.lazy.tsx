import { useRoute } from "preact-iso";

import { useAction } from "@/hooks/useResource";
import { api } from "@/utils/api";
import {
  buildDrawingDocumentUrl,
  createAccountWebRuntimeConfig,
} from "@/utils/drawingAppLinks";

const Invitation = () => {
  const acceptDocumentInvitationMutation = useAction(
    api.acceptDocumentInvitation.mutate,
  );
  const { token } = useRoute().params;
  const runtimeConfig = createAccountWebRuntimeConfig();

  const acceptInvitation = async () => {
    try {
      const data = await acceptDocumentInvitationMutation.run({ token });
      if (data?.documentId)
        window.location.assign(
          buildDrawingDocumentUrl(data.documentId, runtimeConfig),
        );
    } catch {
      alert("Failed to accept invitation. Please try again.");
    }
  };

  return (
    <section className="portal-card portal-card--centered">
      <h1 className="portal-title">Document invitation</h1>
      <p className="portal-subtitle">Accept the invitation to this document.</p>
      <div className="portal-actions">
        <button
          type="button"
          className="ds-button"
          data-tone="primary"
          disabled={acceptDocumentInvitationMutation.pending}
          onClick={acceptInvitation}
        >
          Accept Document Invitation
        </button>
      </div>
    </section>
  );
};

export default Invitation;
