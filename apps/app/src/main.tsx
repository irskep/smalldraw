import { createWebAnalytics } from "@smalldraw/shared/analytics";
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./components/App/App.js";

import "./portal.css";

const analytics = createWebAnalytics();
analytics.page(window.location.pathname);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App onPageChange={() => analytics.page(window.location.pathname)} />
  </React.StrictMode>,
);
