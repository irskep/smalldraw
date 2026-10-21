import { Icon } from "@/components/Icon";
import { useLocation } from "preact-iso";
import { appPath } from "../config";
import { Search } from "lucide";
import { useState } from "react";
import { AdminAccessGate } from "@/admin/AdminAccessGate";

const Admin = () => {
  const { route } = useLocation();
  const [lookupUsername, setLookupUsername] = useState("");

  return (
    <AdminAccessGate>
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
              route(appPath(`admin/users/${encodeURIComponent(username)}`));
            }}
          >
            <input
              className="portal-input portal-input--short"
              value={lookupUsername}
              onChange={(event) => setLookupUsername(event.currentTarget.value)}
              placeholder="Search account"
              aria-label="User lookup"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              inputMode="search"
              name="admin-user-lookup"
              spellcheck={false}
              type="search"
            />
            <button type="submit" className="ds-button">
              <Icon icon={Search} className="portal-action-icon" />
              Search
            </button>
          </form>
        </section>
      </section>
    </AdminAccessGate>
  );
};

export default Admin;
