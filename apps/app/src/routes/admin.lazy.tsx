import {
  createLazyFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { AdminAccessGate } from "@/admin/AdminAccessGate";

const Admin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lookupUsername, setLookupUsername] = useState("");

  return (
    <AdminAccessGate>
      {location.pathname === "/admin" ? (
        <section className="portal-page portal-admin" aria-label="Admin">
          <div className="portal-page__header">
            <h1 className="portal-title">Admin</h1>
            <p className="portal-subtitle">User support tools.</p>
          </div>

          <section className="portal-card portal-card--padded">
            <h2 className="portal-title">Find user</h2>
            <form
              className="portal-form portal-form--inline"
              onSubmit={(event) => {
                event.preventDefault();
                const username = lookupUsername.trim();
                if (!username) {
                  return;
                }
                navigate({
                  to: "/admin/users/$username",
                  params: { username },
                });
              }}
            >
              <input
                className="portal-input portal-input--short"
                value={lookupUsername}
                onChange={(event) => setLookupUsername(event.target.value)}
                placeholder="Search account"
                aria-label="User lookup"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                inputMode="search"
                name="admin-user-lookup"
                spellCheck={false}
                type="search"
              />
              <button type="submit" className="ds-button">
                <Search className="portal-action-icon" />
                Search
              </button>
            </form>
          </section>
        </section>
      ) : (
        <Outlet />
      )}
    </AdminAccessGate>
  );
};

export const Route = createLazyFileRoute("/admin")({
  component: Admin,
});
