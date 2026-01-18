import type { ShapeHandlerRegistry, Shape, ShapeTransform } from '@smalldraw/core';
import { normalizeShapeTransform } from '@smalldraw/core';
import Konva from 'konva';
import type { Layer } from 'konva/lib/Layer.js';

import {
  defaultShapeRendererRegistry,
  renderShapeNode,
  type ShapeRendererRegistry,
} from './shapes.js';

/**
 * Maintains a map of shape ID → Konva node and performs incremental updates
 * instead of full re-renders.
 */
export class KonvaReconciler {
  private nodes = new Map<string, Konva.Group>();
  private registry: ShapeRendererRegistry;
  private geometryRegistry?: ShapeHandlerRegistry;

  constructor(
    registry: ShapeRendererRegistry = defaultShapeRendererRegistry,
    geometryRegistry?: ShapeHandlerRegistry,
  ) {
    this.registry = registry;
    this.geometryRegistry = geometryRegistry;
  }

  /**
   * Incrementally update the layer based on dirty/deleted state.
   * Only modified shapes are touched; clean shapes remain untouched.
   */
  reconcile(
    layer: Layer,
    shapes: Shape[],
    dirty: Set<string>,
    deleted: Set<string>,
  ): void {
    // 1. Remove nodes for deleted shapes
    for (const id of deleted) {
      const node = this.nodes.get(id);
      if (node) {
        node.destroy();
        this.nodes.delete(id);
      }
    }

    // 2. Build a set of current shape IDs for detecting additions
    const currentIds = new Set(shapes.map((s) => s.id));

    // 3. Update or add shapes
    for (const shape of shapes) {
      const existing = this.nodes.get(shape.id);

      if (existing) {
        // Existing shape - only update if dirty
        if (dirty.has(shape.id)) {
          this.updateNode(existing, shape);
        }
        // else: clean, leave it alone
      } else {
        // New shape - create and add
        const node = renderShapeNode(shape, this.registry, this.geometryRegistry);
        if (node) {
          this.nodes.set(shape.id, node);
          layer.add(node);
        }
      }
    }

    // 4. Remove nodes for shapes no longer in the document (defensive cleanup)
    for (const [id, node] of this.nodes) {
      if (!currentIds.has(id)) {
        node.destroy();
        this.nodes.delete(id);
      }
    }

    // 5. Update z-order to match shape order
    this.updateZOrder(layer, shapes);
  }

  /**
   * Perform a full render, clearing the reconciler state.
   * Use this for initial render or when dirty tracking is unavailable.
   */
  fullRender(layer: Layer, shapes: Shape[]): void {
    // Mark all existing as dirty and nothing as deleted
    const allDirty = new Set(shapes.map((s) => s.id));
    // Also mark all tracked nodes for removal if they're not in shapes
    const deleted = new Set<string>();
    for (const id of this.nodes.keys()) {
      if (!allDirty.has(id)) {
        deleted.add(id);
      }
    }
    this.reconcile(layer, shapes, allDirty, deleted);
  }

  /**
   * Clear all tracked nodes. Call when destroying the layer.
   */
  clear(): void {
    for (const node of this.nodes.values()) {
      node.destroy();
    }
    this.nodes.clear();
  }

  /**
   * Get the Konva node for a shape ID, if it exists.
   */
  getNode(shapeId: string): Konva.Group | undefined {
    return this.nodes.get(shapeId);
  }

  /**
   * Check if a shape has a rendered node.
   */
  hasNode(shapeId: string): boolean {
    return this.nodes.has(shapeId);
  }

  /**
   * Update an existing node's transform and geometry.
   */
  private updateNode(group: Konva.Group, shape: Shape): void {
    // Update transform on the group
    this.applyTransform(group, shape.transform);

    // Update opacity
    group.opacity(shape.opacity ?? 1);

    // For simplicity, rebuild geometry children
    // A more sophisticated approach could diff geometry properties
    group.destroyChildren();
    const renderer = this.registry.get(shape.geometry.type);
    if (renderer) {
      const nodes = renderer(shape);
      if (nodes) {
        const list = Array.isArray(nodes) ? nodes : [nodes];
        for (const node of list) {
          group.add(node);
        }
      }
    }
  }

  /**
   * Apply a shape transform to a Konva group.
   */
  private applyTransform(group: Konva.Group, transform?: ShapeTransform): void {
    const t = normalizeShapeTransform(transform);
    group.position({ x: t.translation.x, y: t.translation.y });
    group.rotation((t.rotation * 180) / Math.PI);
    group.scale({ x: t.scale.x, y: t.scale.y });
    group.offset({ x: t.origin.x, y: t.origin.y });
  }

  /**
   * Update z-order of nodes to match shape order.
   * Shapes are expected to be in z-order (sorted by zIndex).
   */
  private updateZOrder(layer: Layer, shapes: Shape[]): void {
    // Start at 1 to keep shapes above background rect
    let zIndex = 1;
    for (const shape of shapes) {
      const node = this.nodes.get(shape.id);
      if (node) {
        node.zIndex(zIndex);
        zIndex += 1;
      }
    }
  }
}
