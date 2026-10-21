import { describe, expect, test } from "vitest";
import { buildInvitationUrl } from "../components/DocumentInvitation/buildInvitationUrl";

describe("DocumentInvitation", () => {
  test("builds invitation URL from current origin", () => {
    expect(buildInvitationUrl("abc123", "http://192.168.1.58:3001")).toBe(
      "http://192.168.1.58:3001/invitation/abc123",
    );
  });
});
