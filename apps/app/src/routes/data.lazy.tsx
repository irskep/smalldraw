import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/data")({
  component: DataPage,
});

function DataPage() {
  return (
    <section className="portal-page portal-text-page" aria-label="Where your drawings are saved">
      <div className="portal-page__header">
        <h1 className="portal-title">Where your drawings are saved</h1>
      </div>

      <div className="portal-text-page__body">
        <h2>Without an account</h2>
        <p>
          Drawings are saved in this browser on this device. They aren’t
          uploaded unless you share them.
        </p>
        <p>
          Clearing your browser’s data can erase these drawings. Browsers can
          also remove saved data automatically, so use an account for drawings
          you want to keep.
        </p>

        <h2>If you use Safari</h2>
        <p>
          Safari can erase drawings saved only in your browser after seven days
          of Safari use without interacting with Splatterboard. Sign in to keep
          drawings you want to save in your account.
        </p>
        <p>
          <a href="https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/#7-day-cap-on-all-script-writeable-storage">
            Read about Safari’s storage policy
          </a>
        </p>

        <h2>With an account</h2>
        <p>
          When you sign in or create an account, drawings on this device are
          added to your account. Changes save automatically when you’re
          online. Sign in on another device to find your drawings there.
        </p>

        <h2>Sharing</h2>
        <p>
          Sharing uploads your drawing and creates a link. Anyone with that
          link can open it. Saving a drawing to your account doesn’t share it.
        </p>

        <h2>Signing out</h2>
        <p>
          Splatterboard finishes saving your changes before removing your
          account’s drawings from this browser. Your drawings stay in your
          account.
        </p>
        <p>
          If saving fails, your drawings remain on the device so you can try
          again.
        </p>

        <h2>Your password</h2>
        <p>
          Accounts use a username and password, with no email address. There’s
          no password reset, so use a password manager.
        </p>
      </div>
    </section>
  );
}
