import { analyticsEnabled, setAnalyticsEnabled } from "@smalldraw/shared";
import { useEffect, useState } from "react";

export function AnalyticsPreference() {
  const [enabled, setEnabled] = useState(() => analyticsEnabled());
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    const refresh = () => setEnabled(analyticsEnabled());
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  return (
    <section
      id="analytics"
      className="portal-section portal-analytics-preference"
      aria-label="Analytics settings"
    >
      <h2>Usage statistics</h2>
      <label className="portal-checkbox-field">
        <input
          className="portal-checkbox"
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            const next = event.target.checked;
            setSaved(setAnalyticsEnabled(next));
            setEnabled(next);
          }}
        />
        Share usage statistics
      </label>
      <p>
        Help us learn which tools and coloring pages are popular. We don’t send
        your drawings or account details.
      </p>
      <p>
        This choice applies to this browser, whether you’re signed in or not. It
        doesn’t change settings on your other devices.
      </p>
      <p role="status">
        {saved
          ? enabled
            ? "Usage statistics are on."
            : "Usage statistics are off."
          : "Your browser couldn’t save this choice. It applies until you leave or reload this page."}
      </p>
    </section>
  );
}
