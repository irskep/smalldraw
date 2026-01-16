[**@smalldraw/core**](README.md)

***

# @smalldraw/core

## Classes

- [AddShape](classes/AddShape.md)
- [CompositeAction](classes/CompositeAction.md)
- [DeleteShape](classes/DeleteShape.md)
- [DrawingStore](classes/DrawingStore.md)
- [ToolRuntimeImpl](classes/ToolRuntimeImpl.md)
- [UndoManager](classes/UndoManager.md)
- [UpdateShapeFill](classes/UpdateShapeFill.md)
- [UpdateShapeGeometry](classes/UpdateShapeGeometry.md)
- [UpdateShapeOpacity](classes/UpdateShapeOpacity.md)
- [UpdateShapeStroke](classes/UpdateShapeStroke.md)
- [UpdateShapeTransform](classes/UpdateShapeTransform.md)
- [UpdateShapeZIndex](classes/UpdateShapeZIndex.md)

## Interfaces

- [BezierGeometry](interfaces/BezierGeometry.md)
- [BezierNode](interfaces/BezierNode.md)
- [Bounds](interfaces/Bounds.md)
- [BrushStyle](interfaces/BrushStyle.md)
- [CanonicalShapeTransform](interfaces/CanonicalShapeTransform.md)
- [DraftShape](interfaces/DraftShape.md)
- [DragCallbacks](interfaces/DragCallbacks.md)
- [DrawingDocument](interfaces/DrawingDocument.md)
- [DrawingStoreOptions](interfaces/DrawingStoreOptions.md)
- [EllipseGeometry](interfaces/EllipseGeometry.md)
- [GradientFill](interfaces/GradientFill.md)
- [GradientStop](interfaces/GradientStop.md)
- [HandleDescriptor](interfaces/HandleDescriptor.md)
- [PathGeometry](interfaces/PathGeometry.md)
- [PathSegment](interfaces/PathSegment.md)
- [PenGeometry](interfaces/PenGeometry.md)
- [PenToolOptions](interfaces/PenToolOptions.md)
- [Point](interfaces/Point.md)
- [PointerDragEvent](interfaces/PointerDragEvent.md)
- [PolygonGeometry](interfaces/PolygonGeometry.md)
- [RectangleToolOptions](interfaces/RectangleToolOptions.md)
- [RectGeometry](interfaces/RectGeometry.md)
- [RegularPolygonGeometry](interfaces/RegularPolygonGeometry.md)
- [SelectionState](interfaces/SelectionState.md)
- [Shape](interfaces/Shape.md)
- [ShapeInteractions](interfaces/ShapeInteractions.md)
- [ShapeTransform](interfaces/ShapeTransform.md)
- [SharedToolSettings](interfaces/SharedToolSettings.md)
- [Size](interfaces/Size.md)
- [SolidFill](interfaces/SolidFill.md)
- [StrokeGeometry](interfaces/StrokeGeometry.md)
- [ToolDefinition](interfaces/ToolDefinition.md)
- [ToolPointerEvent](interfaces/ToolPointerEvent.md)
- [ToolRuntime](interfaces/ToolRuntime.md)
- [UndoableAction](interfaces/UndoableAction.md)

## Type Aliases

- [Fill](type-aliases/Fill.md)
- [Geometry](type-aliases/Geometry.md)
- [HandleBehavior](type-aliases/HandleBehavior.md)
- [StrokeStyle](type-aliases/StrokeStyle.md)
- [ToolEventHandler](type-aliases/ToolEventHandler.md)
- [ToolEventName](type-aliases/ToolEventName.md)
- [ToolRuntimeEvent](type-aliases/ToolRuntimeEvent.md)

## Variables

- [RESIZABLE\_GEOMETRY\_TYPES](variables/RESIZABLE_GEOMETRY_TYPES.md)

## Functions

- [\_\_getResizeAdapterForTest](functions/getResizeAdapterForTest.md)
- [applyTransformToPoint](functions/applyTransformToPoint.md)
- [attachPointerHandlers](functions/attachPointerHandlers.md)
- [canonicalizeShape](functions/canonicalizeShape.md)
- [createBoundsFromPoints](functions/createBoundsFromPoints.md)
- [createDocument](functions/createDocument.md)
- [createPenTool](functions/createPenTool.md)
- [createPointerDragHandler](functions/createPointerDragHandler.md)
- [createRectangleTool](functions/createRectangleTool.md)
- [createSelectionTool](functions/createSelectionTool.md)
- [getBoundsCenter](functions/getBoundsCenter.md)
- [getBoundsFromPoints](functions/getBoundsFromPoints.md)
- [getGeometryLocalBounds](functions/getGeometryLocalBounds.md)
- [getOrderedShapes](functions/getOrderedShapes.md)
- [getShapeBounds](functions/getShapeBounds.md)
- [getTopZIndex](functions/getTopZIndex.md)
- [getZIndexBetween](functions/getZIndexBetween.md)
- [normalizeShapeTransform](functions/normalizeShapeTransform.md)
