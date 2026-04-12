import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createLazyFileRoute } from "@tanstack/react-router";
import { buildDrawingDocumentUrl } from "@/utils/drawingAppLinks";
import { trpc } from "../../utils/trpc";

const Invitation: React.FC = () => {
  const acceptDocumentInvitationMutation =
    trpc.acceptDocumentInvitation.useMutation();
  const { token } = Route.useParams();

  const acceptInvitation = () => {
    acceptDocumentInvitationMutation.mutate(
      { token },
      {
        onError: () => {
          alert("Failed to accept invitation. Please try again.");
        },
        onSuccess: (data) => {
          if (data?.documentId) {
            window.location.assign(buildDrawingDocumentUrl(data.documentId));
          }
        },
      },
    );
  };

  return (
    <Card className="p-4">
      <p className="mb-4">Accept the invitation to this document.</p>
      <Button
        disabled={acceptDocumentInvitationMutation.isPending}
        onClick={acceptInvitation}
      >
        Accept Document Invitation
      </Button>
    </Card>
  );
};

export const Route = createLazyFileRoute("/invitation/$token")({
  component: Invitation,
});
