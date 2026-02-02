import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { RepoContext, useRepo } from "@automerge/automerge-repo-react-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { getQueryKey } from "@trpc/react-query";
import { useEffect, useState } from "react";
import { DocumentMembers } from "@/components/DocumentMembers/DocumentMembers";
import { Input } from "@/components/ui/input";
import { getRepo } from "@/utils/automergeRepo";
import { Checklist } from "../../components/Checklist/Checklist";
import { trpc } from "../../utils/trpc";

// Custom hook that waits for handle to be ready (unlike useHandle which doesn't)
function useHandleReady<T>(id: AutomergeUrl): DocHandle<T> | undefined {
  const repo = useRepo();
  const [, setReady] = useState(0);
  const [handle, setHandle] = useState<DocHandle<T>>();

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const currentId = id;

    void (async () => {
      const nextHandle = await repo.find<T>(id);
      if (cancelled) return;
      await nextHandle.whenReady();
      if (cancelled || currentId !== id) return;
      setHandle(nextHandle);
      setReady((v) => v + 1);

      const onUpdate = () => setReady((v) => v + 1);
      nextHandle.on("change", onUpdate);
      nextHandle.on("delete", onUpdate);
      cleanup = () => {
        nextHandle.off("change", onUpdate);
        nextHandle.off("delete", onUpdate);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [repo, id]);

  return handle;
}

// Inner component that uses custom hook (requires RepoContext)
const DocumentContent = ({ documentId }: { documentId: string }) => {
  const queryClient = useQueryClient();
  const rootDocUrl = `automerge:${documentId}` as AutomergeUrl;
  const handle = useHandleReady(rootDocUrl);
  const getDocumentQuery = trpc.getDocument.useQuery(documentId);
  const documentQueryKey = getQueryKey(trpc.getDocument, handle?.documentId);
  const updateDocumentMutation = trpc.updateDocument.useMutation({
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: documentQueryKey }),
  });

  if (!handle) {
    return <div className="p-4 text-center">Loading list...</div>;
  }

  if (handle.isDeleted()) {
    return <div className="p-4 text-center">List deleted</div>;
  }

  return (
    <>
      <div className="flex justify-between gap-4 pb-8 pt-4 items-end flex-wrap">
        {getDocumentQuery.data?.isAdmin ? (
          <Input
            className="max-w-48 text-xl"
            value={
              updateDocumentMutation.isPending
                ? updateDocumentMutation.variables.name
                : getDocumentQuery.data?.name || ""
            }
            onChange={(event) => {
              // Note: could be improved by throttling
              updateDocumentMutation.mutate({
                id: handle.documentId,
                name: event.target.value,
              });
            }}
          />
        ) : (
          <div className="text-xl">{getDocumentQuery.data?.name}</div>
        )}

        <DocumentMembers
          documentId={documentId}
          handle={handle}
          currentUserIsAdmin={getDocumentQuery.data?.isAdmin || false}
        />
      </div>
      <Checklist docUrl={handle.url} />
    </>
  );
};

// Outer component that provides RepoContext
const Document = () => {
  const repo = getRepo();
  const { documentId } = Route.useParams();

  if (!repo) {
    return (
      <div className="p-4 text-center text-red-500">
        Sync not initialized - try logging in again
      </div>
    );
  }

  return (
    <RepoContext.Provider value={repo}>
      <DocumentContent documentId={documentId} />
    </RepoContext.Provider>
  );
};

export const Route = createLazyFileRoute("/list/$documentId")({
  component: Document,
});
