import { createWebAnalytics } from "@smalldraw/shared/analytics";
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./components/App/App.js";
import { appPath } from "./config";
import { ColoringBook } from "./utils/router";

const analytics = createWebAnalytics();
analytics.page(window.location.pathname);

const root = document.getElementById("root")!;
const app = (
  <React.StrictMode>
    <App onPageChange={() => analytics.page(window.location.pathname)} />
  </React.StrictMode>
);

function mount() {
  if (root.hasChildNodes()) ReactDOM.hydrateRoot(root, app);
  else ReactDOM.createRoot(root).render(app);
}
// Keep the generated gallery visible while its client code downloads.
if (
  window.location.pathname.replace(/\/$/, "") === appPath("coloringbook") ||
  window.location.pathname.startsWith(appPath("coloringbook/"))
) {
  void ColoringBook.preload().then(mount);
} else mount();
