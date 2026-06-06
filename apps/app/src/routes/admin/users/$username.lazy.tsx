import {
  createLazyFileRoute,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { AdminUserSupportPage } from "@/admin/AdminUserSupportPage";

const AdminUser = () => {
  const location = useLocation();
  const { username } = Route.useParams();
  const isUserPage =
    location.pathname === `/admin/users/${encodeURIComponent(username)}`;

  return isUserPage ? <AdminUserSupportPage username={username} /> : <Outlet />;
};

export const Route = createLazyFileRoute("/admin/users/$username")({
  component: AdminUser,
});
