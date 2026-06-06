import type React from "react";
import { trpc } from "@/utils/trpc";

type Props = {
  children: React.ReactNode;
};

export const AdminAccessGate: React.FC<Props> = ({ children }) => {
  const meQuery = trpc.me.useQuery();

  if (meQuery.isLoading) {
    return (
      <section className="account-page account-admin" aria-label="Admin">
        <div className="account-page__header">
          <h1 className="account-title">Admin</h1>
          <p className="account-muted">Checking access…</p>
        </div>
      </section>
    );
  }

  if (!meQuery.data?.isServerAdmin) {
    return (
      <section className="account-page account-admin" aria-label="Admin">
        <div className="account-page__header">
          <h1 className="account-title">Admin access required</h1>
          <p className="account-muted">
            Log in with a server admin account to use these tools.
          </p>
        </div>
      </section>
    );
  }

  return <>{children}</>;
};
