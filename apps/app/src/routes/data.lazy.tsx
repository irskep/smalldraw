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
        <h2>By Default, Nothing Is Stored on the Server</h2>
        <p>
          When you make a drawing, it stays in your browser. It does not get
          stored on splatterboard.app&apos;s server.
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
          If you create an account, your shared drawings will be accessible to
          all your devices.
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

        <h2>How to Tell Where Your Drawing Is</h2>
        <p>
          In the upper right corner, there is some text that will say
          &quot;Offline&quot; or &quot;Online&quot;. If it says
          &quot;Online&quot;, your document is stored on the server.
        </p>
      </div>
    </section>
  );
}
