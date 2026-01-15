import { describe, expect, test } from 'bun:test';

import {
  AddShape,
  UpdateShapeGeometry,
} from '../actions';
import { createDocument } from '../model/document';
import type { Geometry } from '../model/geometry';
import type { Shape } from '../model/shape';
import { UndoManager } from '../undo';

function createShape(id: string, geometry: Geometry): Shape {
  return {
    id,
    geometry,
    zIndex: id,
  };
}

describe('Geometry actions', () => {
  test('pen geometry can be added and updated', () => {
    const doc = createDocument();
    const undo = new UndoManager();
    const pen = createShape('pen', {
      type: 'pen',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    });

    undo.apply(new AddShape(pen), doc);
    expect(doc.shapes[pen.id]?.geometry).toEqual(pen.geometry);

    const updatedGeometry: Geometry = {
      type: 'pen',
      points: [
        { x: 5, y: 5 },
        { x: 15, y: 15 },
        { x: 20, y: 0 },
      ],
      simulatePressure: true,
    };
    undo.apply(new UpdateShapeGeometry(pen.id, updatedGeometry), doc);
    expect(doc.shapes[pen.id]?.geometry).toEqual(updatedGeometry);
    undo.undo(doc);
    expect(doc.shapes[pen.id]?.geometry).toEqual(pen.geometry);
  });

  test('circle geometry adds center/radius and can be updated', () => {
    const doc = createDocument();
    const undo = new UndoManager();
    const circle = createShape('circle', {
      type: 'circle',
      center: { x: 50, y: 50 },
      radius: 25,
    });
    undo.apply(new AddShape(circle), doc);
    expect(doc.shapes[circle.id]?.geometry).toEqual(circle.geometry);

    const next: Geometry = {
      type: 'circle',
      center: { x: 20, y: 40 },
      radius: 10,
    };
    undo.apply(new UpdateShapeGeometry(circle.id, next), doc);
    expect(doc.shapes[circle.id]?.geometry).toEqual(next);
    undo.undo(doc);
    expect(doc.shapes[circle.id]?.geometry).toEqual(circle.geometry);
  });

  test('rect geometry persists bounds', () => {
    const doc = createDocument();
    const undo = new UndoManager();
    const rect = createShape('rect', {
      type: 'rect',
      bounds: {
        origin: { x: 0, y: 0 },
        size: { width: 100, height: 40 },
      },
    });
    undo.apply(new AddShape(rect), doc);
    expect(doc.shapes[rect.id]?.geometry).toEqual(rect.geometry);

    const next: Geometry = {
      type: 'rect',
      bounds: {
        origin: { x: 10, y: 10 },
        size: { width: 50, height: 50 },
      },
    };
    undo.apply(new UpdateShapeGeometry(rect.id, next), doc);
    expect(doc.shapes[rect.id]?.geometry).toEqual(next);
    undo.undo(doc);
    expect(doc.shapes[rect.id]?.geometry).toEqual(rect.geometry);
  });

  test('regular polygon geometry tracks sides and rotation', () => {
    const doc = createDocument();
    const undo = new UndoManager();
    const polygon = createShape('regular-polygon', {
      type: 'regularPolygon',
      center: { x: 0, y: 0 },
      radius: 30,
      sides: 6,
    });
    undo.apply(new AddShape(polygon), doc);
    expect(doc.shapes[polygon.id]?.geometry).toEqual(polygon.geometry);

    const next: Geometry = {
      type: 'regularPolygon',
      center: { x: 10, y: 10 },
      radius: 40,
      sides: 5,
      rotation: Math.PI / 4,
    };
    undo.apply(new UpdateShapeGeometry(polygon.id, next), doc);
    expect(doc.shapes[polygon.id]?.geometry).toEqual(next);
    undo.undo(doc);
    expect(doc.shapes[polygon.id]?.geometry).toEqual(polygon.geometry);
  });

  test('arbitrary polygon geometry stores vertices', () => {
    const doc = createDocument();
    const undo = new UndoManager();
    const poly = createShape('poly', {
      type: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ],
    });
    undo.apply(new AddShape(poly), doc);
    expect(doc.shapes[poly.id]?.geometry).toEqual(poly.geometry);

    const next: Geometry = {
      type: 'polygon',
      points: [
        { x: 10, y: 10 },
        { x: 30, y: 10 },
        { x: 20, y: 30 },
        { x: 5, y: 20 },
      ],
      closed: true,
    };
    undo.apply(new UpdateShapeGeometry(poly.id, next), doc);
    expect(doc.shapes[poly.id]?.geometry).toEqual(next);
    undo.undo(doc);
    expect(doc.shapes[poly.id]?.geometry).toEqual(poly.geometry);
  });

  test('bezier geometry persists nodes and handles', () => {
    const doc = createDocument();
    const undo = new UndoManager();
    const bezier = createShape('bezier', {
      type: 'bezier',
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
    undo.apply(new AddShape(bezier), doc);
    expect(doc.shapes[bezier.id]?.geometry).toEqual(bezier.geometry);

    const next: Geometry = {
      type: 'bezier',
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
    undo.apply(new UpdateShapeGeometry(bezier.id, next), doc);
    expect(doc.shapes[bezier.id]?.geometry).toEqual(next);
    undo.undo(doc);
    expect(doc.shapes[bezier.id]?.geometry).toEqual(bezier.geometry);
  });
});
