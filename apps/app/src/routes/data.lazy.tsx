import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/data")({
  component: DataPage,
});

function DataPage() {
  return (
    <section className="portal-page portal-text-page" aria-label="Data">
      <div className="portal-page__header">
        <h1 className="portal-title">How Splatterboard Handles Your Data</h1>
        <p>
          This page details how Splatterboard handles your data in practical
          terms. These behaviors were designed as technical tradeoffs to
          maximize privacy, avoid data loss, and minimize server cost.
        </p>
      </div>

      <div className="portal-text-page__body">
        <h2>Without an Account, Drawings Stay on This Device</h2>
        <p>
          When you draw without signing in, your drawings are saved on this device.
          They are uploaded only if you share them.
        </p>

        <h2>When You Click Share, Drawings Are Stored on the Server</h2>
        <p>
          Sharing requires storing the document on the server so it can be sent
          to multiple devices or people.
        </p>

        <h2>Accounts Are Optional</h2>
        <p>
          Without an account, your data is owned by your device. If you share a
          drawing, it gets stored on the server, but only devices with the share
          link can see it. This means if you share a drawing, and then open
          splatterboard.app on your phone, you won&apos;t see your drawing.
        </p>
        <p>
          When you sign in or create an account, drawings on this device are added
          to your account. All your drawings then sync automatically, so you can
          open them on another device. Sharing is a separate choice.
        </p>

        <h2>A Warning About Safari</h2>
        <p>
          Safari on iOS and macOS delete local data for a web site after 7 days
          of no user interaction.{" "}
          <a href="https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/">
            https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
          </a>
        </p>
        <p>
          Other browsers, like Chrome and Firefox, do not proactively delete
          your data.
        </p>

        <h2>A Note About Emails</h2>
        <p>
          You are not asked for your email when you sign up, just for a username
          and password. Splatterboard is not interested in getting in touch with
          you, marketing to you, or contacting you for any reason. If you lose
          your password, there is no recourse.
        </p>

        <h2>Signing Out</h2>
        <p>
          Signing out waits until your drawings have finished syncing, then removes
          your account’s drawings from this device. They stay in your account and
          return when you sign in again. If syncing fails, your drawings stay on
          this device until you can reconnect and try again.
        </p>
      </div>
    </section>
  );
}
