import { trpc } from "@/utils/trpc";
import { DocumentInvitation } from "../DocumentInvitation/DocumentInvitation";

type Props = {
  documentId: string;
  currentUserIsAdmin: boolean;
};

export const DocumentMembers: React.FC<Props> = ({
  documentId,
  currentUserIsAdmin,
}) => {
  const utils = trpc.useUtils();
  const documentMembersQuery = trpc.documentMembers.useQuery(documentId);
  const documentAccessTokensQuery = trpc.documentAccessTokens.useQuery(
    documentId,
    {
      enabled: currentUserIsAdmin,
    },
  );
  const revokeDocumentAccessTokenMutation =
    trpc.revokeDocumentAccessToken.useMutation({
      onSuccess: async () => {
        await documentAccessTokensQuery.refetch();
        await utils.documentAccessTokens.invalidate(documentId);
      },
    });

  return (
    <div className="account-two-column">
      <section className="account-card">
        <header className="account-card__header">
          <h2 className="account-title">Members</h2>
        </header>
        <div className="account-card__body">
          {documentMembersQuery.isLoading ? (
            <p className="account-muted">Loading members…</p>
          ) : null}
          {documentMembersQuery.data?.map((user) => (
            <div key={user.id} className="account-list-item">
              <div className="account-list-item__main">
                <div>{user.username}</div>
                <div className="account-muted account-muted--small account-code">
                  {user.id}
                </div>
              </div>
              <div className="account-muted account-muted--small">
                {user.isAdmin ? "document admin" : "member"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="account-card">
        <header className="account-card__header">
          <h2 className="account-title">Access</h2>
        </header>
        <div className="account-card__body">
          {currentUserIsAdmin ? (
            <DocumentInvitation documentId={documentId} />
          ) : (
            <p className="account-muted">
              Only document admins can manage access tokens.
            </p>
          )}

          {currentUserIsAdmin ? (
            <div className="account-list">
              <h3 className="account-label">Active non-share tokens</h3>
              {documentAccessTokensQuery.isLoading ? (
                <p className="account-muted">Loading tokens…</p>
              ) : null}
              {documentAccessTokensQuery.data?.length === 0 ? (
                <p className="account-muted">
                  No owner or device tokens recorded.
                </p>
              ) : null}
              {documentAccessTokensQuery.data?.map((token) => (
                <div
                  key={token.id}
                  className="account-list-item account-list-item--stacked"
                >
                  <div className="account-list-item">
                    <div>
                      {token.scope}
                      {token.tag ? `:${token.tag}` : ""}
                    </div>
                    <div className="account-muted account-muted--small">
                      {token.revokedAt ? "revoked" : "active"}
                    </div>
                  </div>
                  <div className="account-muted account-muted--small">
                    Created: {new Date(token.createdAt).toLocaleString()}
                  </div>
                  <div className="account-muted account-muted--small">
                    Last used:{" "}
                    {token.lastUsedAt
                      ? new Date(token.lastUsedAt).toLocaleString()
                      : "never"}
                  </div>
                  {token.scope === "device" && !token.revokedAt ? (
                    <button
                      type="button"
                      className="ds-button"
                      disabled={revokeDocumentAccessTokenMutation.isPending}
                      onClick={() =>
                        revokeDocumentAccessTokenMutation.mutate({
                          documentId,
                          tokenId: token.id,
                        })
                      }
                    >
                      Revoke device token
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};
