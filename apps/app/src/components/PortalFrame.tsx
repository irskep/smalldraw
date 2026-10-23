import type { ComponentChildren } from "preact";

import { appPath } from "../config";

/** Shared HTML shell; account behavior belongs to PortalLayout, not prerendering. */
export function PortalFrame({
  children,
  navigation = <div />,
  notice,
  dialogs,
  layout = "",
}: {
  children: ComponentChildren;
  navigation?: ComponentChildren;
  notice?: ComponentChildren;
  dialogs?: ComponentChildren;
  layout?: string;
}) {
  return (
    <div className="portal-shell" data-layout={layout}>
      <header className="portal-header">
        <a href={appPath("")} className="portal-brand">
          Splatterboard
        </a>
        <nav className="portal-nav" aria-label="Account">
          {navigation}
        </nav>
      </header>
      {notice}
      <main className="portal-main">{children}</main>
      {dialogs}
    </div>
  );
}
