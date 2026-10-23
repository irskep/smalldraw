import { AdminAccessGate } from "@/admin/AdminAccessGate";
import { AdminModerationFeed } from "@/admin/AdminModerationPage";

export default function Admin() {
  return (
    <AdminAccessGate>
      <AdminModerationFeed />
    </AdminAccessGate>
  );
}
