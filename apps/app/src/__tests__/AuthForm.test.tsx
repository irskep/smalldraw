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

  test("renders form-level errors", () => {
    render(
      <AuthForm
        onSubmit={vi.fn()}
        isPending={false}
        errorMessage="No account exists for that username."
      >
        Login
      </AuthForm>,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "No account exists for that username.",
    );
  });

  test("blocks signup when age confirmation is unchecked", () => {
    const onSubmit = vi.fn();

    render(
      <AuthForm
        onSubmit={onSubmit}
        isPending={false}
        requireAgeConfirmation
      >
        Sign up
      </AuthForm>,
    );

    fireEvent.input(screen.getByPlaceholderText("Username"), {
      target: { value: "new-user" },
    });
    fireEvent.input(screen.getByPlaceholderText("Password"), {
      target: { value: "asdfjkl;" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign up" }).closest("form")!,
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "A parent must make the account.",
    );
  });

  test("submits signup when age confirmation is checked", () => {
    const onSubmit = vi.fn();

    render(
      <AuthForm
        onSubmit={onSubmit}
        isPending={false}
        requireAgeConfirmation
      >
        Sign up
      </AuthForm>,
    );

    fireEvent.input(screen.getByPlaceholderText("Username"), {
      target: { value: "new-user" },
    });
    fireEvent.input(screen.getByPlaceholderText("Password"), {
      target: { value: "asdfjkl;" },
    });
    fireEvent.click(screen.getByLabelText("I am at least 16 years old"));
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign up" }).closest("form")!,
    );

    expect(onSubmit).toHaveBeenCalledWith({
      username: "new-user",
      password: "asdfjkl;",
    });
  });
});
