export function createServerAnnouncePolicy(options: {
  getServerPeerId: () => string | null;
  isCollaborativeDocumentId: (documentId: string) => Promise<boolean>;
}) {
  return async (peerId: string, documentId?: string): Promise<boolean> => {
    if (!documentId) {
      return true;
    }
    const serverPeerId = options.getServerPeerId();
    if (!serverPeerId || peerId !== serverPeerId) {
      return true;
    }
    const allowed = await options.isCollaborativeDocumentId(documentId);
    console.info("[kids-draw:multiplayer] announce policy decision", {
      peerId,
      serverPeerId,
      documentId,
      allowed,
    });
    return allowed;
  };
}
