import { createLazyFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DocumentMembers } from "@/components/DocumentMembers/DocumentMembers";
import { trpc } from "../../utils/trpc";

const Document = () => {
  const { documentId } = Route.useParams();
  const getDocumentQuery = trpc.getDocument.useQuery(documentId);
  const updateDocumentMutation = trpc.updateDocument.useMutation();

  if (getDocumentQuery.isLoading) {
    return <div className="p-4 text-center">Loading document…</div>;
  }

  if (getDocumentQuery.error || !getDocumentQuery.data) {
    return (
      <div className="p-4 text-center text-red-500">
        Unable to load document metadata.
      </div>
    );
  }

  const document = getDocumentQuery.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Document ID</div>
            <div className="font-mono text-xs">{document.id}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Name</div>
            {document.isAdmin ? (
              <Input
                value={
                  updateDocumentMutation.isPending
                    ? updateDocumentMutation.variables.name
                    : document.name
                }
                onChange={(event) =>
                  updateDocumentMutation.mutate({
                    id: document.id,
                    name: event.target.value,
                  })
                }
              />
            ) : (
              <div>{document.name}</div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            Role: {document.isAdmin ? "document admin" : "member"}
          </div>
        </CardContent>
      </Card>

      <DocumentMembers
        documentId={documentId}
        currentUserIsAdmin={document.isAdmin}
      />
    </div>
  );
};

export const Route = createLazyFileRoute("/documents/$documentId")({
  component: Document,
});
