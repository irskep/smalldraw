[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / applyActionToDoc

# Function: applyActionToDoc()

> **applyActionToDoc**(`doc`, `action`, `registry`, `changeFn?`): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/model/document.ts:30](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/document.ts#L30)

## Parameters

### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

### action

[`UndoableAction`](../interfaces/UndoableAction.md)

### registry

[`ShapeHandlerRegistry`](../classes/ShapeHandlerRegistry.md)

### changeFn?

(`doc`, `update`) => [`DrawingDocument`](../type-aliases/DrawingDocument.md)

## Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)
