[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DrawingStoreOptions

# Interface: DrawingStoreOptions

Defined in: [core/src/store/drawingStore.ts:23](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L23)

## Properties

### actionDispatcher()?

> `optional` **actionDispatcher**: (`event`) => `void`

Defined in: [core/src/store/drawingStore.ts:31](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L31)

#### Parameters

##### event

[`DrawingStoreActionEvent`](DrawingStoreActionEvent.md)

#### Returns

`void`

***

### document?

> `optional` **document**: `Doc`\<[`DrawingDocumentData`](DrawingDocumentData.md)\>

Defined in: [core/src/store/drawingStore.ts:24](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L24)

***

### initialSharedSettings?

> `optional` **initialSharedSettings**: [`SharedToolSettings`](SharedToolSettings.md)

Defined in: [core/src/store/drawingStore.ts:27](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L27)

***

### onAction()?

> `optional` **onAction**: (`event`) => `void`

Defined in: [core/src/store/drawingStore.ts:30](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L30)

#### Parameters

##### event

[`DrawingStoreActionEvent`](DrawingStoreActionEvent.md)

#### Returns

`void`

***

### onDocumentChanged()?

> `optional` **onDocumentChanged**: (`doc`) => `void`

Defined in: [core/src/store/drawingStore.ts:29](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L29)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

#### Returns

`void`

***

### onRenderNeeded()?

> `optional` **onRenderNeeded**: () => `void`

Defined in: [core/src/store/drawingStore.ts:28](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L28)

#### Returns

`void`

***

### onUndoFailure()?

> `optional` **onUndoFailure**: (`message`) => `void`

Defined in: [core/src/store/drawingStore.ts:32](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L32)

#### Parameters

##### message

`string`

#### Returns

`void`

***

### shapeHandlers?

> `optional` **shapeHandlers**: [`ShapeHandlerRegistry`](../classes/ShapeHandlerRegistry.md)

Defined in: [core/src/store/drawingStore.ts:33](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L33)

***

### tools

> **tools**: [`ToolDefinition`](ToolDefinition.md)[]

Defined in: [core/src/store/drawingStore.ts:26](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L26)

***

### undoManager?

> `optional` **undoManager**: [`UndoManager`](../classes/UndoManager.md)

Defined in: [core/src/store/drawingStore.ts:25](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L25)
