import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { DocumentListCard } from "../components/DocumentListCard/DocumentListCard";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params: { documentId: string };
  }) => (
    <a href={`${to.replace("$documentId", params.documentId)}`}>{children}</a>
  ),
}));

describe("DocumentListCard", () => {
  test("renders thumbnail when present", () => {
    render(
      <DocumentListCard
        id="doc-1"
        name="Thumb Doc"
        thumbnailUrl="https://cdn.example.com/documents/doc-1/thumbnail.png"
      />,
    );

    expect(screen.getByAltText("Thumb Doc thumbnail")).toBeTruthy();
    expect(screen.queryByText("No preview")).toBeNull();
  });

  test("renders fallback when thumbnail is missing", () => {
    render(<DocumentListCard id="doc-2" name="No Thumb Doc" />);

    expect(screen.getByText("No preview")).toBeTruthy();
  });
});
