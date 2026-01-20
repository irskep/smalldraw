import { describe, expect, test } from "bun:test";

import { type ActionContext, AddShape, UpdateShapeGeometry } from "../actions";
import { createDocument } from "../model/document";
import type { Geometry } from "../model/geometry";
import type { Shape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";
import { UndoManager } from "../undo";

function createShape(id: string, geometry: Geometry): Shape {
  const registry = getDefaultShapeHandlerRegistry();
  return canonicalizeShape(
    {
      id,
      geometry,
      zIndex: id,
      transform: {
        translation: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
      },
    },
    registry,
  );
}

function canonicalGeometry(shape: Shape, geometry: Geometry): Geometry {
  const registry = getDefaultShapeHandlerRegistry();
  return canonicalizeShape({ ...shape, geometry }, registry).geometry;
}

describe("Geometry actions", () => {
  test("pen geometry can be added and updated", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const pen = createShape("pen", {
      type: "pen",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    });

    undo.apply(new AddShape(pen), doc, ctx);
    expect(doc.shapes[pen.id]?.geometry).toEqual(pen.geometry);

    const updatedGeometry: Geometry = {
      type: "pen",
      points: [
        { x: 5, y: 5 },
        { x: 15, y: 15 },
        { x: 20, y: 0 },
      ],
      simulatePressure: true,
    };
    undo.apply(new UpdateShapeGeometry(pen.id, updatedGeometry), doc, ctx);
    expect(doc.shapes[pen.id]?.geometry).toEqual(
      canonicalGeometry(pen, updatedGeometry),
    );
    undo.undo(doc, ctx);
    expect(doc.shapes[pen.id]?.geometry).toEqual(pen.geometry);
  });

  test("ellipse geometry stores radius values", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const ellipse = createShape("ellipse", {
      type: "ellipse",
      radiusX: 30,
      radiusY: 15,
    });
    undo.apply(new AddShape(ellipse), doc, ctx);
    expect(doc.shapes[ellipse.id]?.geometry).toEqual(ellipse.geometry);

    const next: Geometry = {
      type: "ellipse",
      radiusX: 10,
      radiusY: 5,
    };
    undo.apply(new UpdateShapeGeometry(ellipse.id, next), doc, ctx);
    expect(doc.shapes[ellipse.id]?.geometry).toEqual(next);
    undo.undo(doc, ctx);
    expect(doc.shapes[ellipse.id]?.geometry).toEqual(ellipse.geometry);
  });

  test("rect geometry persists bounds", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const rect = createShape("rect", {
      type: "rect",
      size: { width: 100, height: 40 },
    });
    undo.apply(new AddShape(rect), doc, ctx);
    expect(doc.shapes[rect.id]?.geometry).toEqual(rect.geometry);

    const next: Geometry = {
      type: "rect",
      size: { width: 50, height: 50 },
    };
    undo.apply(new UpdateShapeGeometry(rect.id, next), doc, ctx);
    expect(doc.shapes[rect.id]?.geometry).toEqual(next);
    undo.undo(doc, ctx);
    expect(doc.shapes[rect.id]?.geometry).toEqual(rect.geometry);
  });

  test("regular polygon geometry tracks sides and rotation", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const polygon = createShape("regular-polygon", {
      type: "regularPolygon",
      radius: 30,
      sides: 6,
    });
    undo.apply(new AddShape(polygon), doc, ctx);
    expect(doc.shapes[polygon.id]?.geometry).toEqual(polygon.geometry);

    const next: Geometry = {
      type: "regularPolygon",
      radius: 40,
      sides: 5,
    };
    undo.apply(new UpdateShapeGeometry(polygon.id, next), doc, ctx);
    expect(doc.shapes[polygon.id]?.geometry).toEqual(next);
    undo.undo(doc, ctx);
    expect(doc.shapes[polygon.id]?.geometry).toEqual(polygon.geometry);
  });

  test("arbitrary polygon geometry stores vertices", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const poly = createShape("poly", {
      type: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ],
    });
    undo.apply(new AddShape(poly), doc, ctx);
    expect(doc.shapes[poly.id]?.geometry).toEqual(poly.geometry);

    const next: Geometry = {
      type: "polygon",
      points: [
        { x: 10, y: 10 },
        { x: 30, y: 10 },
        { x: 20, y: 30 },
        { x: 5, y: 20 },
      ],
      closed: true,
    };
    undo.apply(new UpdateShapeGeometry(poly.id, next), doc, ctx);
    expect(doc.shapes[poly.id]?.geometry).toEqual(
      canonicalGeometry(poly, next),
    );
    undo.undo(doc, ctx);
    expect(doc.shapes[poly.id]?.geometry).toEqual(poly.geometry);
  });

  test("bezier geometry persists nodes and handles", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const bezier = createShape("bezier", {
      type: "bezier",
      nodes: [
        {
          anchor: { x: 0, y: 0 },
          handleOut: { x: 10, y: 0 },
        },
        {
          anchor: { x: 20, y: 0 },
          handleIn: { x: 10, y: 5 },
        },
      ],
    });
    undo.apply(new AddShape(bezier), doc, ctx);
    expect(doc.shapes[bezier.id]?.geometry).toEqual(bezier.geometry);

    const next: Geometry = {
      type: "bezier",
      nodes: [
        {
          anchor: { x: 5, y: 5 },
          handleOut: { x: 15, y: 5 },
        },
        {
          anchor: { x: 25, y: 10 },
          handleIn: { x: 15, y: 10 },
          handleOut: { x: 30, y: 15 },
        },
        {
          anchor: { x: 35, y: 20 },
          handleIn: { x: 30, y: 15 },
        },
      ],
      closed: true,
    };
    undo.apply(new UpdateShapeGeometry(bezier.id, next), doc, ctx);
    expect(doc.shapes[bezier.id]?.geometry).toEqual(
      canonicalGeometry(bezier, next),
    );
    undo.undo(doc, ctx);
    expect(doc.shapes[bezier.id]?.geometry).toEqual(bezier.geometry);
  });
});
