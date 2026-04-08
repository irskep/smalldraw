import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AuthForm } from "../components/AuthForm/AuthForm";

describe("AuthForm", () => {
  test("submits entered credentials", () => {
    const onSubmit = vi.fn();

    render(
      <AuthForm onSubmit={onSubmit} isPending={false}>
        Login
      </AuthForm>,
    );

    fireEvent.input(screen.getByPlaceholderText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.input(screen.getByPlaceholderText("Password"), {
      target: { value: "asdfjkl;" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Login" }).closest("form")!,
    );

    expect(onSubmit).toHaveBeenCalledWith({
      username: "admin",
      password: "asdfjkl;",
    });
  });
});
