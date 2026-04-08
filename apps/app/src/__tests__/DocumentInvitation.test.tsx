import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  DocumentInvitationView,
} from "../components/DocumentInvitation/DocumentInvitation";
import { buildInvitationUrl } from "../components/DocumentInvitation/buildInvitationUrl";

describe("DocumentInvitation", () => {
  test("builds invitation URL from current origin", () => {
    expect(buildInvitationUrl("abc123", "http://192.168.1.58:3001")).toBe(
      "http://192.168.1.58:3001/invitation/abc123",
    );
  });

  test("renders invitation URL and rotate action", () => {
    const onRotate = vi.fn();

    render(
      <DocumentInvitationView
        invitationUrl="http://localhost:3001/invitation/token-1"
        isPending={false}
        onRotate={onRotate}
      />,
    );

    expect(
      screen.getByDisplayValue("http://localhost:3001/invitation/token-1"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /rotate/i }));

    expect(onRotate).toHaveBeenCalledTimes(1);
  });
});
