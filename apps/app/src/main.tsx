import React from "react";
import ReactDOM from "react-dom/client";
import "./checklist.css";
import { App } from "./components/App/App.js";
import "./index.css";
import "./utils/automergeRepo";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
