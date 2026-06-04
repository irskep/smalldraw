import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link, createLazyFileRoute } from "@tanstack/react-router";
import { DocumentListCard } from "@/components/DocumentListCard/DocumentListCard";
import {
  buildDrawingDocumentUrl,
  createAccountWebRuntimeConfig,
} from "@/utils/drawingAppLinks";
import { trpc } from "../utils/trpc";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const documentsQuery = trpc.documents.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const createDocumentMutation = trpc.createDocument.useMutation();
  const runtimeConfig = createAccountWebRuntimeConfig();
  const isNotAuthorized = documentsQuery.error?.data?.code === "UNAUTHORIZED";

  if (documentsQuery.isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (isNotAuthorized) {
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-3xl font-semibold">Splatterboard</h1>
        <p className="mx-auto max-w-lg pt-3 text-muted-foreground">
          Sign in to browse your saved drawings and start new account-backed
          drawings. Public drawing without an account is coming back here next.
        </p>
        <div className="flex justify-center gap-3 pt-6">
          <Button asChild>
            <Link to="/login">Login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/register">Sign up</Link>
          </Button>
        </div>
      </Card>
    );
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
                window.location.assign(
                  buildDrawingDocumentUrl(document.id, runtimeConfig),
                );
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
            drawingUrl={buildDrawingDocumentUrl(doc.id, runtimeConfig)}
            thumbnailUrl={doc.thumbnailUrl}
          />
        ))}
      </div>
    </>
  );
}
