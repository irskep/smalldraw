import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/privacy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <section className="portal-page" aria-label="Privacy policy">
      <div className="portal-page__header">
        <h1 className="portal-title">Privacy Policy</h1>
      </div>
    </section>
  );
}
