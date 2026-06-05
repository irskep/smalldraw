import { describe, expect, test } from "vitest";
import { getAuthFailureMessage } from "../hooks/authErrors";

describe("auth error messages", () => {
  test("maps login failures to specific messages", () => {
    expect(
      getAuthFailureMessage(new Error("user not registered"), "login"),
    ).toBe("No account exists for that username.");
    expect(
      getAuthFailureMessage(new Error("login already started"), "login"),
    ).toBe("Login is already in progress. Wait a few seconds and try again.");
    expect(getAuthFailureMessage(new Error("bad password"), "login")).toBe(
      "The username or password is incorrect.",
    );
  });

  test("maps register failures to specific messages", () => {
    expect(
      getAuthFailureMessage(new Error("user already registered"), "register"),
    ).toBe("That username is already taken.");
    expect(getAuthFailureMessage(new Error("opaque failed"), "register")).toBe(
      "Sign up failed. Please try again.",
    );
  });

  test("maps network-like failures", () => {
    expect(getAuthFailureMessage(new Error("Load failed"), "login")).toBe(
      "Could not reach the server. Check your connection and try again.",
    );
  });
});
