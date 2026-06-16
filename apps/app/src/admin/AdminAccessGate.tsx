import type React from "react";
import { trpc } from "@/utils/trpc";

type Props = {
  children: React.ReactNode;
};

export const AdminAccessGate: React.FC<Props> = ({ children }) => {
  const meQuery = trpc.me.useQuery();

  if (meQuery.isLoading) {
    return (
      <section className="portal-page portal-admin" aria-label="Admin">
        <div className="portal-page__header">
          <h1 className="portal-title">Admin</h1>
          <p className="portal-muted">Checking access…</p>
        </div>
      </section>
    );
  }

  if (!meQuery.data?.isServerAdmin) {
    return (
      <section className="portal-page portal-admin" aria-label="Admin">
        <div className="portal-page__header">
          <h1 className="portal-title">Admin access required</h1>
          <p className="portal-muted">
            Log in with a server admin account to use these tools.
          </p>
        </div>
      </section>
    );
  }

  return <>{children}</>;
};
