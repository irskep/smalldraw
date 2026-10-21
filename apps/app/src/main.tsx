import { createWebAnalytics } from "@smalldraw/shared";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./components/App/App.js";
import { router } from "./utils/router";
import "./portal.css";

const analytics = createWebAnalytics();
analytics.page(window.location.pathname);
router.subscribe("onResolved", () => analytics.page(window.location.pathname));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
