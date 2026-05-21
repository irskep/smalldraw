import { el } from "redom";
import { createDocumentAccessState } from "../../src";
import type { HarnessStory } from "./types";

export const stateStories: HarnessStory[] = [
  {
    id: "document-access-state",
    title: "Document Access State",
    description:
      "Inline startup/document-open error state with auth recovery and local reset actions.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const viewport = el("div.ds-story-viewport") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "No action yet.",
      ) as HTMLOutputElement;
      const authRequired = createDocumentAccessState({
        title: "You can't access this drawing",
        description:
          "This drawing needs account access. Log in or sign up to continue.",
        message: "Log in or sign up to open this account-linked drawing.",
        loginUrl: "http://localhost:3000/account/login?redirect=%2F%3Fdoc%3Ddemo",
        signupUrl:
          "http://localhost:3000/account/register?redirect=%2F%3Fdoc%3Ddemo",
      });
      authRequired.setOnRetry(() => {
        status.textContent = "Retry pressed.";
      });
      authRequired.setOnReset(() => {
        status.textContent = "Reset Local Session pressed.";
      });

      const genericFailure = createDocumentAccessState({
        title: "Could not open drawing",
        description:
          "The requested drawing could not be opened. Choose another drawing or start a new one.",
        message: "Unexpected failure while resolving the requested document.",
      });
      genericFailure.setOnRetry(() => {
        status.textContent = "Retry pressed on generic failure.";
      });
      genericFailure.setOnReset(() => {
        status.textContent = "Reset Local Session pressed on generic failure.";
      });

      viewport.append(authRequired.el);
      canvas.append(viewport, genericFailure.el, status);
      container.replaceChildren(canvas);
    },
  },
];
