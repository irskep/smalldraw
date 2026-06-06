import { createLazyFileRoute } from "@tanstack/react-router";
import { AdminUserSupportPage } from "@/admin/AdminUserSupportPage";

const AdminUserDocument = () => {
  const { documentId, username } = Route.useParams();

  return <AdminUserSupportPage documentId={documentId} username={username} />;
};

export const Route = createLazyFileRoute(
  "/admin/users/$username/documents/$documentId",
)({
  component: AdminUserDocument,
});
