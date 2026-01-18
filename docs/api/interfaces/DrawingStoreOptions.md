[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DrawingStoreOptions

# Interface: DrawingStoreOptions

Defined in: [store/drawingStore.ts:22](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L22)

## Properties

### document?

> `optional` **document**: [`DrawingDocument`](DrawingDocument.md)

Defined in: [store/drawingStore.ts:23](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L23)

***

### initialSharedSettings?

> `optional` **initialSharedSettings**: [`SharedToolSettings`](SharedToolSettings.md)

Defined in: [store/drawingStore.ts:26](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L26)

***

### onRenderNeeded()?

> `optional` **onRenderNeeded**: () => `void`

Defined in: [store/drawingStore.ts:27](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L27)

#### Returns

`void`

***

### shapeHandlers?

> `optional` **shapeHandlers**: [`ShapeHandlerRegistry`](../classes/ShapeHandlerRegistry.md)

Defined in: [store/drawingStore.ts:28](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L28)

***

### tools

> **tools**: [`ToolDefinition`](ToolDefinition.md)[]

Defined in: [store/drawingStore.ts:25](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L25)

***

### undoManager?

> `optional` **undoManager**: [`UndoManager`](../classes/UndoManager.md)

Defined in: [store/drawingStore.ts:24](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L24)
