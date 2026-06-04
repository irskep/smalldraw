import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DocumentListCard } from "../components/DocumentListCard/DocumentListCard";

describe("DocumentListCard", () => {
  test("renders thumbnail when present", () => {
    render(
      <DocumentListCard
        id="doc-1"
        name="Thumb Doc"
        drawingUrl="http://localhost:3000/draw/?doc=doc-1"
        thumbnailUrl="https://cdn.example.com/documents/doc-1/thumbnail.png"
      />,
    );

    expect(screen.getByAltText("Thumb Doc thumbnail")).toBeTruthy();
    expect(screen.queryByText("No preview")).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "http://localhost:3000/draw/?doc=doc-1",
    );
  });

  test("renders fallback when thumbnail is missing", () => {
    render(
      <DocumentListCard
        id="doc-2"
        name="No Thumb Doc"
        drawingUrl="http://localhost:3000/draw/?doc=doc-2"
      />,
    );

    expect(screen.getByText("No preview")).toBeTruthy();
  });
});
