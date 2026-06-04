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
    <div className="account-form-field">
      <label htmlFor={id} className="account-label">
        Share link
      </label>
      <div className="account-form-row">
        <input
          id={id}
          value={invitationUrl}
          readOnly
          onFocus={(event) => event.target.select()}
          className="account-input account-input--share"
        />
        <button
          type="button"
          className="ds-button"
          disabled={isPending}
          onClick={onRotate}
        >
          <RefreshCcw className="account-action-icon" />
          Rotate
        </button>
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
