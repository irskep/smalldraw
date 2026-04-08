import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCcw } from "lucide-react";
import React, { useId } from "react";
import { buildInvitationUrl } from "./buildInvitationUrl";
import { trpc } from "../../utils/trpc";

type Props = {
  documentId: string;
};

type DocumentInvitationViewProps = {
  invitationUrl: string;
  isPending: boolean;
  onRotate: () => void;
};

export const DocumentInvitationView: React.FC<DocumentInvitationViewProps> = ({
  invitationUrl,
  isPending,
  onRotate,
}) => {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="text-sm">
        Share link
      </label>
      <div className="flex gap-2 pt-2">
        <Input
          id={id}
          value={invitationUrl}
          readOnly
          onFocus={(event) => event.target.select()}
          className="w-72"
        />
        <Button disabled={isPending} onClick={onRotate}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Rotate
        </Button>
      </div>
    </div>
  );
};

export const DocumentInvitation: React.FC<Props> = ({ documentId }) => {
  const documentInvitationQuery = trpc.documentInvitation.useQuery(documentId);
  const createOrRefreshDocumentInvitationMutation =
    trpc.createOrRefreshDocumentInvitation.useMutation();

  return (
    <DocumentInvitationView
      invitationUrl={buildInvitationUrl(documentInvitationQuery.data?.token)}
      isPending={createOrRefreshDocumentInvitationMutation.isPending}
      onRotate={() =>
        createOrRefreshDocumentInvitationMutation.mutate(
          { documentId },
          {
            onSuccess: () => {
              documentInvitationQuery.refetch();
            },
          },
        )
      }
    />
  );
};
