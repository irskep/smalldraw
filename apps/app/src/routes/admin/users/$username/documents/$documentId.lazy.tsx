import { useRoute } from "preact-iso";

import { AdminAccessGate } from "@/admin/AdminAccessGate";
import { AdminUserSupportPage } from "@/admin/AdminUserSupportPage";

export default function AdminUserDocument() {
  const { username, documentId } = useRoute().params;
  return (
    <AdminAccessGate>
      <AdminUserSupportPage username={username} documentId={documentId} />
    </AdminAccessGate>
  );
}
