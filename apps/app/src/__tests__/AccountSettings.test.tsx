import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AccountSettings } from "../routes/account.lazy";

const changePasswordStart = vi.fn();
const changePasswordFinish = vi.fn();

vi.mock("../utils/trpc", () => ({
  trpc: {
    me: {
      useQuery: () => ({
        data: { username: "admin", isServerAdmin: true },
        isLoading: false,
      }),
    },
    changePasswordStart: {
      useMutation: () => ({
        isPending: false,
        mutateAsync: changePasswordStart,
      }),
    },
    changePasswordFinish: {
      useMutation: () => ({
        isPending: false,
        mutateAsync: changePasswordFinish,
      }),
    },
  },
}));

describe("AccountSettings", () => {
  beforeEach(() => {
    changePasswordStart.mockClear();
    changePasswordFinish.mockClear();
  });

  test("renders current account identity", () => {
    render(<AccountSettings />);

    expect(screen.getByText("admin (admin)")).toBeTruthy();
  });

  test("validates password confirmation locally", () => {
    render(<AccountSettings />);

    fireEvent.input(screen.getByPlaceholderText("Current password"), {
      target: { value: "old-password" },
    });
    fireEvent.input(screen.getByPlaceholderText("New password"), {
      target: { value: "new-password" },
    });
    fireEvent.input(screen.getByPlaceholderText("Confirm new password"), {
      target: { value: "different-password" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Change password" })
        .closest("form")!,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "New password and confirmation do not match.",
    );
    expect(changePasswordStart).not.toHaveBeenCalled();
    expect(changePasswordFinish).not.toHaveBeenCalled();
  });
});
