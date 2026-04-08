import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {documentMembersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading members…</p>
          ) : null}
          {documentMembersQuery.data?.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <div className="font-medium">{user.username}</div>
                <div className="text-xs text-muted-foreground">{user.id}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                {user.isAdmin ? "document admin" : "member"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentUserIsAdmin ? (
            <DocumentInvitation documentId={documentId} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Only document admins can manage access tokens.
            </p>
          )}

          {currentUserIsAdmin ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Active non-share tokens</h3>
              {documentAccessTokensQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading tokens…</p>
              ) : null}
              {documentAccessTokensQuery.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No owner or device tokens recorded.
                </p>
              ) : null}
              {documentAccessTokensQuery.data?.map((token) => (
                <div
                  key={token.id}
                  className="space-y-2 rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">
                      {token.scope}
                      {token.tag ? `:${token.tag}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {token.revokedAt ? "revoked" : "active"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(token.createdAt).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last used:{" "}
                    {token.lastUsedAt
                      ? new Date(token.lastUsedAt).toLocaleString()
                      : "never"}
                  </div>
                  {token.scope === "device" && !token.revokedAt ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={revokeDocumentAccessTokenMutation.isPending}
                      onClick={() =>
                        revokeDocumentAccessTokenMutation.mutate({
                          documentId,
                          tokenId: token.id,
                        })
                      }
                    >
                      Revoke device token
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
