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
    <section className="account-card account-card--centered">
      <h1 className="account-title">Document invitation</h1>
      <p className="account-subtitle">
        Accept the invitation to this document.
      </p>
      <div className="account-actions">
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
