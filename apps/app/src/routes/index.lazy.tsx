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
    return <div className="account-page__header">Loading...</div>;
  }

  if (isNotAuthorized) {
    return (
      <section className="account-card account-card--centered">
        <h1 className="account-title account-title--large">Splatterboard</h1>
        <p className="account-subtitle">
          Sign in to browse your saved drawings and start new account-backed
          drawings. Public drawing without an account is coming back here next.
        </p>
        <div className="account-actions">
          <Link to="/login" className="ds-button" data-tone="primary">
            Login
          </Link>
          <Link to="/register" className="ds-button">
            Sign up
          </Link>
        </div>
      </section>
    );
  }

  if (documentsQuery.error) {
    return (
      <div className="account-alert" data-tone="danger" role="alert">
        Error loading documents: {documentsQuery.error.message}
      </div>
    );
  }

  return (
    <section className="account-page">
      <div className="account-page__header">
        <h1 className="account-title">Your documents</h1>
        <p className="account-subtitle">
          Account-attached documents you can manage from this server.
        </p>
      </div>
      <form
        className="account-form account-form--inline"
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
        <input
          type="text"
          name="name"
          placeholder="Document name"
          className="account-input account-input--short"
          autoComplete="off"
        />
        <button
          type="submit"
          className="ds-button"
          data-tone="primary"
          disabled={createDocumentMutation.isPending}
        >
          Create Document
        </button>
      </form>

      <div className="account-document-list">
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
    </section>
  );
}
