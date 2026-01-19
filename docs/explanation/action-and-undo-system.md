# Action and Undo System

All document changes go through actions. An action knows how to apply a change and how to reverse it.

## The Action Interface

```typescript
interface ActionContext {
  registry: ShapeHandlerRegistry;
}

interface UndoableAction {
  redo(doc: DrawingDocument, ctx: ActionContext): void;
  undo(doc: DrawingDocument, ctx: ActionContext): void;
  affectedShapeIds(): string[];
  affectsZOrder(): boolean;
}
```

Both methods receive the document and action context and mutate the document directly. `redo` applies the change; `undo` reverses it. The context currently carries the shape handler registry for canonicalization and geometry logic. The metadata helpers (`affectedShapeIds`, `affectsZOrder`) let the store update dirty state and caches efficiently.

## Redo-First Design

When you commit an action, the system calls `redo`, not a separate "do" method:

```mermaid
sequenceDiagram
    participant Tool
    participant UndoManager
    participant Action
    participant Document

    Tool->>UndoManager: apply(action)
    UndoManager->>Action: redo(doc, ctx)
    Action->>Document: mutate
    UndoManager->>UndoManager: push to undo stack
```

No distinction between first apply and reapply after undo.

## Recording Undo Data

Actions capture what they need to reverse themselves. `AddShape` keeps the shape:

```typescript
class AddShape implements UndoableAction {
  constructor(private shape: Shape) {}

  redo(doc: DrawingDocument, ctx: ActionContext): void {
    doc.shapes[this.shape.id] = canonicalizeShape(this.shape, ctx.registry);
  }

  undo(doc: DrawingDocument, ctx: ActionContext): void {
    delete doc.shapes[this.shape.id];
  }

  affectedShapeIds(): string[] {
    return [this.shape.id];
  }

  affectsZOrder(): boolean {
    return true;
  }
}
```

Actions that modify existing data capture previous state during `redo`:

```typescript
redo(doc: DrawingDocument, ctx: ActionContext): void {
  const shape = doc.shapes[this.shapeId];
  this.previousTransform = shape.transform;  // capture for undo
  shape.transform = this.newTransform;
}
```

## The Undo Manager

Two stacks:

```mermaid
flowchart LR
    subgraph UndoStack
        A1[Action 1]
        A2[Action 2]
        A3[Action 3]
    end
    subgraph RedoStack
        B1[Action 4]
    end
```

- `apply(action)` — calls `redo`, pushes to undo stack, clears redo stack
- `undo()` — pops from undo, calls `undo`, pushes to redo
- `redo()` — pops from redo, calls `redo`, pushes to undo

New actions clear the redo stack.

## Composite Actions

Multiple changes that should undo together:

```typescript
class CompositeAction implements UndoableAction {
  constructor(private actions: UndoableAction[]) {}

  redo(doc, ctx): void {
    this.actions.forEach(a => a.redo(doc, ctx));
  }

  undo(doc, ctx): void {
    // Reverse order
    [...this.actions].reverse().forEach(a => a.undo(doc, ctx));
  }

  affectedShapeIds(): string[] {
    return this.actions.flatMap(action => action.affectedShapeIds());
  }

  affectsZOrder(): boolean {
    return this.actions.some(action => action.affectsZOrder());
  }
}
```

Moving multiple selected shapes creates one `CompositeAction`. One undo reverts all.

## Available Actions

| Action | Purpose |
|--------|---------|
| `AddShape` | Insert shape |
| `DeleteShape` | Remove shape |
| `UpdateShapeGeometry` | Change geometry |
| `UpdateShapeTransform` | Change position/rotation/scale |
| `UpdateShapeFill` | Change fill |
| `UpdateShapeStroke` | Change stroke |
| `UpdateShapeOpacity` | Change opacity |
| `UpdateZIndex` | Change stacking order |
| `CompositeAction` | Group actions |
