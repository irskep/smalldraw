import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLazyFileRoute } from "@tanstack/react-router";
import { DocumentListCard } from "@/components/DocumentListCard/DocumentListCard";
import { buildDrawingDocumentUrl } from "@/utils/drawingAppLinks";
import { trpc } from "../utils/trpc";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const documentsQuery = trpc.documents.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const createDocumentMutation = trpc.createDocument.useMutation();

  if (documentsQuery.isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (documentsQuery.error) {
    return (
      <div className="p-4 text-center text-red-500">
        Error loading documents: {documentsQuery.error.message}
      </div>
    );
  }

  return (
    <>
      <div className="pb-6 text-center">
        <h1 className="text-2xl font-semibold">Your documents</h1>
        <p className="pt-2 text-sm text-muted-foreground">
          Account-attached documents you can manage from this server.
        </p>
      </div>
      <form
        className="flex justify-center items-center gap-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();

          createDocumentMutation.mutate(
            // @ts-expect-error form name is defined
            { name: event.target.name.value },
            {
              onSuccess: ({ document }) => {
                window.location.assign(buildDrawingDocumentUrl(document.id));
                documentsQuery.refetch();
              },
              onError: () => {
                alert("Failed to create the document");
              },
            },
          );
        }}
      >
        <Input
          type="text"
          name="name"
          placeholder="Document name"
          className="max-w-48"
          autoComplete="off"
        />
        <Button type="submit" disabled={createDocumentMutation.isPending}>
          Create Document
        </Button>
      </form>

      <div className="flex flex-col gap-2 pt-4">
        {documentsQuery.data?.map((doc) => (
          <DocumentListCard
            key={doc.id}
            id={doc.id}
            name={doc.name}
            drawingUrl={buildDrawingDocumentUrl(doc.id)}
            thumbnailUrl={doc.thumbnailUrl}
          />
        ))}
      </div>
    </>
  );
}
