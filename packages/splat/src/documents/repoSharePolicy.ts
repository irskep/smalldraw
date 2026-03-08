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
    return await options.isCollaborativeDocumentId(documentId);
  };
}
