import { describe, expect, test } from "bun:test";
import { DocumentAccessError } from "@smalldraw/splat";
import { Window } from "happy-dom";
import {
  buildStartupErrorScreenModel,
  renderStartupErrorScreen,
} from "./startupErrorScreen";

function installHappyDomGlobals(window: Window): void {
  const globals = globalThis as typeof globalThis & {
    window?: typeof globalThis.window;
    document?: typeof globalThis.document;
    HTMLElement?: typeof globalThis.HTMLElement;
    SVGElement?: typeof globalThis.SVGElement;
  };
  globals.window = window as unknown as typeof globalThis.window;
  globals.document = window.document as unknown as typeof globalThis.document;
  globals.HTMLElement =
    window.HTMLElement as unknown as typeof globalThis.HTMLElement;
  globals.SVGElement =
    window.SVGElement as unknown as typeof globalThis.SVGElement;
}

describe("buildStartupErrorScreenModel", () => {
  test("builds login and signup actions for auth-required document access", () => {
    const model = buildStartupErrorScreenModel(
      new DocumentAccessError({
        reason: "auth_required",
        title: "You can't access this drawing",
        userMessage: "Log in or sign up to open this account-linked drawing.",
      }),
      "http://localhost:3000/?doc=server-doc",
    );

    expect(model).toEqual({
      title: "You can't access this drawing",
      description:
        "This drawing needs account access. Log in or sign up to continue.",
      message: "Log in or sign up to open this account-linked drawing.",
      loginUrl: "http://localhost:3000/account/login?redirect=%2F%3Fdoc%3Dserver-doc",
      signupUrl:
        "http://localhost:3000/account/register?redirect=%2F%3Fdoc%3Dserver-doc",
    });
  });

  test("uses the generic startup fallback for unexpected errors", () => {
    const model = buildStartupErrorScreenModel(
      new Error("Unexpected failure"),
      "http://localhost:3000/",
    );

    expect(model).toEqual({
      title: "Could not open drawing",
      description: "Startup failed. This should not leave a blank screen.",
      message: "Unexpected failure",
    });
  });

  test("renders startup errors inside a centered recovery shell", () => {
    const window = new Window();
    const root = window.document.createElement("div");
    installHappyDomGlobals(window);

    renderStartupErrorScreen(root as unknown as HTMLElement, new Error("Unexpected failure"));

    const shell = root.querySelector(
      ".splat-web-startup-error-screen",
    ) as HTMLDivElement | null;
    expect(shell).not.toBeNull();
    expect(shell?.firstElementChild?.classList.contains("ds-document-access-state")).toBeTrue();
  });
});
