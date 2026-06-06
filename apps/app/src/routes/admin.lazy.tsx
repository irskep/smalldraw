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
        <section className="account-page account-admin" aria-label="Admin">
          <div className="account-page__header">
            <h1 className="account-title">Admin</h1>
            <p className="account-subtitle">User support tools.</p>
          </div>

          <section className="account-card account-card--padded">
            <h2 className="account-title">Find user</h2>
            <form
              className="account-form account-form--inline"
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
                className="account-input account-input--short"
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
                <Search className="account-action-icon" />
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
