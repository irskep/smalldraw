import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/terms")({
  component: TermsAndConditions,
});

function TermsAndConditions() {
  return (
    <section className="portal-page" aria-label="Terms and conditions">
      <div className="portal-page__header">
        <h1 className="portal-title">Terms and Conditions</h1>
      </div>
    </section>
  );
}
