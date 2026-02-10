import "./main.css";

import { createKidsDrawApp } from "./createKidsDrawApp";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container");
}

const app = await createKidsDrawApp({
  container,
});

(window as unknown as { kidsDrawApp?: typeof app }).kidsDrawApp = app;
