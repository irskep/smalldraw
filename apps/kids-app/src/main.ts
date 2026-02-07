import { createKidsDrawApp } from "./createKidsDrawApp";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container");
}

const app = await createKidsDrawApp({
  container,
  width: 960,
  height: 600,
});

(window as unknown as { kidsDrawApp?: typeof app }).kidsDrawApp = app;
