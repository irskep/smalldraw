import { useRoute } from "preact-iso";
import { AdminAccessGate } from "@/admin/AdminAccessGate";
import { AdminUserSupportPage } from "@/admin/AdminUserSupportPage";

export default function AdminUser() {
  const { username } = useRoute().params;
  return (
    <AdminAccessGate>
      <AdminUserSupportPage username={username} />
    </AdminAccessGate>
  );
}
