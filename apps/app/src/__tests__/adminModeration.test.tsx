import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  feed: vi.fn(),
  find: vi.fn(),
  details: vi.fn(),
  thumbnail: vi.fn(),
  takeDown: vi.fn(),
  retry: vi.fn(),
  route: vi.fn(),
  account: vi.fn(),
}));
vi.mock("../utils/api", () => ({
  api: {
    adminDrawingFeed: { query: mocks.feed },
    adminFindDrawing: { query: mocks.find },
    adminDrawingDetails: { query: mocks.details },
    adminDrawingThumbnail: { query: mocks.thumbnail },
    adminTakeDownDrawing: { mutate: mocks.takeDown },
    adminRetryDrawingCleanup: { mutate: mocks.retry },
  },
}));
vi.mock("preact-iso", () => ({ useLocation: () => ({ route: mocks.route }) }));
vi.mock("../utils/account", () => ({ useAccount: mocks.account }));

import {
  AdminDrawingInspection,
  AdminModerationFeed,
} from "../admin/AdminModerationPage";
import Admin from "../routes/admin.lazy";

function drawing(id = "drawing-one") {
  return {
    id,
    createdAt: 1000,
    contentUpdatedAt: 2000,
    deletedAt: null,
    shared: true,
    owners: [],
    hasThumbnail: false,
    moderation: null,
    shareTokens: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.feed.mockResolvedValue({ items: [drawing()], nextCursor: null });
  mocks.find.mockResolvedValue(drawing());
  mocks.details.mockResolvedValue(drawing());
  mocks.thumbnail.mockResolvedValue(null);
  mocks.takeDown.mockResolvedValue(undefined);
  mocks.retry.mockResolvedValue(undefined);
});

describe("moderation UI", () => {
  it("does not request drawings outside the admin gate", () => {
    mocks.account.mockReturnValue({
      loading: false,
      data: { isServerAdmin: false },
    });
    render(<Admin />);
    expect(screen.getByText("Admin access required")).toBeTruthy();
    expect(mocks.feed).not.toHaveBeenCalled();
  });

  it("loads manually paginated drawings without duplicating a moved card", async () => {
    mocks.feed
      .mockResolvedValueOnce({
        items: [drawing()],
        nextCursor: { at: 2000, id: "drawing-one" },
      })
      .mockResolvedValueOnce({
        items: [drawing(), drawing("drawing-two")],
        nextCursor: null,
      });
    render(<AdminModerationFeed />);
    await waitFor(() => expect(screen.getByText("drawing-one")).toBeTruthy());
    fireEvent.click(screen.getByText("Load more"));
    await waitFor(() => expect(screen.getByText("drawing-two")).toBeTruthy());
    expect(screen.getAllByText("drawing-one")).toHaveLength(1);
    expect(mocks.feed.mock.calls[1][0].cursor).toEqual({
      at: 2000,
      id: "drawing-one",
    });
    expect(mocks.feed).toHaveBeenCalledTimes(2);
  });

  it("shows an unrecognized lookup without navigating", async () => {
    mocks.find.mockResolvedValue(null);
    render(<AdminModerationFeed />);
    fireEvent.change(screen.getByLabelText("Find drawing"), {
      target: { value: "unknown" },
    });
    fireEvent.click(screen.getByText("Find"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Drawing not found",
      ),
    );
    expect(mocks.route).not.toHaveBeenCalled();
  });

  it("requires a reason and confirmation, then replaces content with blocked status", async () => {
    render(<AdminDrawingInspection documentId="drawing-one" />);
    await waitFor(() =>
      expect(screen.getByText("Take down drawing")).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("Take down drawing"));
    expect(
      (screen.getByText("Confirm takedown") as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Harmful content" },
    });
    mocks.details.mockResolvedValue({
      ...drawing(),
      moderation: {
        takenDownAt: 3000,
        administratorId: "admin",
        reason: "Harmful content",
        cleanupState: "pending",
        cleanupAttempts: 1,
        lastError: null,
        completedAt: null,
      },
    });
    fireEvent.click(screen.getByText("Confirm takedown"));
    await waitFor(() =>
      expect(screen.getByText("Pending — access is blocked")).toBeTruthy(),
    );
    expect(mocks.takeDown).toHaveBeenCalledWith({
      documentId: "drawing-one",
      reason: "Harmful content",
    });
    expect(screen.queryByText("Load drawing")).toBeNull();
    expect(screen.getByText("Retry cleanup")).toBeTruthy();
  });
  it("keeps artwork and links hidden when takedown succeeds but status refresh fails", async () => {
    mocks.details.mockResolvedValue({
      ...drawing(),
      hasThumbnail: true,
      shareTokens: ["existing-share"],
    });
    mocks.thumbnail.mockResolvedValue({
      contentType: "image/png",
      data: "YQ==",
    });
    render(<AdminDrawingInspection documentId="drawing-one" />);
    await waitFor(() =>
      expect(screen.getByAltText("Drawing preview")).toBeTruthy(),
    );
    expect(screen.getByText("Share links")).toBeTruthy();
    fireEvent.click(screen.getByText("Take down drawing"));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Harmful content" },
    });
    mocks.details.mockRejectedValue(new Error("Network unavailable"));
    fireEvent.click(screen.getByText("Confirm takedown"));
    await waitFor(() =>
      expect(
        screen.getByText("The drawing is taken down. Access is blocked."),
      ).toBeTruthy(),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Network unavailable",
      ),
    );
    expect(screen.queryByAltText("Drawing preview")).toBeNull();
    expect(screen.queryByText("Share links")).toBeNull();
    expect(screen.queryByText("Load drawing")).toBeNull();
    expect(screen.queryByText("Take down drawing")).toBeNull();
    expect(screen.queryByText("Confirm takedown")).toBeNull();
    expect(screen.getByText("Refresh cleanup status")).toBeTruthy();
  });
});
