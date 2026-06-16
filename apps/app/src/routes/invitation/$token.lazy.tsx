import { createLazyFileRoute } from "@tanstack/react-router";
import {
  buildDrawingDocumentUrl,
  createAccountWebRuntimeConfig,
} from "@/utils/drawingAppLinks";
import { trpc } from "../../utils/trpc";

const Invitation: React.FC = () => {
  const acceptDocumentInvitationMutation =
    trpc.acceptDocumentInvitation.useMutation();
  const { token } = Route.useParams();
  const runtimeConfig = createAccountWebRuntimeConfig();

  const acceptInvitation = () => {
    acceptDocumentInvitationMutation.mutate(
      { token },
      {
        onError: () => {
          alert("Failed to accept invitation. Please try again.");
        },
        onSuccess: (data) => {
          if (data?.documentId) {
            window.location.assign(
              buildDrawingDocumentUrl(data.documentId, runtimeConfig),
            );
          }
        },
      },
    );
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
          disabled={acceptDocumentInvitationMutation.isPending}
          onClick={acceptInvitation}
        >
          Accept Document Invitation
        </button>
      </div>
    </section>
  );
};

export const Route = createLazyFileRoute("/invitation/$token")({
  component: Invitation,
});
