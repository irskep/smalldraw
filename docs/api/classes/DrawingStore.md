[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DrawingStore

# Class: DrawingStore

Defined in: [store/drawingStore.ts:39](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L39)

## Constructors

### Constructor

> **new DrawingStore**(`options`): `DrawingStore`

Defined in: [store/drawingStore.ts:76](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L76)

#### Parameters

##### options

[`DrawingStoreOptions`](../interfaces/DrawingStoreOptions.md)

#### Returns

`DrawingStore`

## Methods

### activateTool()

> **activateTool**(`toolId`): `void`

Defined in: [store/drawingStore.ts:93](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L93)

#### Parameters

##### toolId

`string`

#### Returns

`void`

***

### canRedo()

> **canRedo**(): `boolean`

Defined in: [store/drawingStore.ts:379](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L379)

#### Returns

`boolean`

***

### canUndo()

> **canUndo**(): `boolean`

Defined in: [store/drawingStore.ts:375](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L375)

#### Returns

`boolean`

***

### clearSelection()

> **clearSelection**(): `void`

Defined in: [store/drawingStore.ts:349](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L349)

#### Returns

`void`

***

### consumeDirtyState()

> **consumeDirtyState**(): [`DirtyState`](../interfaces/DirtyState.md)

Defined in: [store/drawingStore.ts:236](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L236)

Consume and clear the dirty state. Call this before rendering to get
the set of shapes that need updating.

#### Returns

[`DirtyState`](../interfaces/DirtyState.md)

***

### dispatch()

> **dispatch**(`event`, `payload`): `void`

Defined in: [store/drawingStore.ts:106](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L106)

#### Parameters

##### event

[`ToolEventName`](../type-aliases/ToolEventName.md)

##### payload

[`ToolPointerEvent`](../interfaces/ToolPointerEvent.md)

#### Returns

`void`

***

### getActiveToolId()

> **getActiveToolId**(): `string` \| `null`

Defined in: [store/drawingStore.ts:297](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L297)

#### Returns

`string` \| `null`

***

### getDocument()

> **getDocument**(): [`DrawingDocument`](../interfaces/DrawingDocument.md)

Defined in: [store/drawingStore.ts:279](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L279)

#### Returns

[`DrawingDocument`](../interfaces/DrawingDocument.md)

***

### getDrafts()

> **getDrafts**(): [`DraftShape`](../interfaces/DraftShape.md)[]

Defined in: [store/drawingStore.ts:113](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L113)

#### Returns

[`DraftShape`](../interfaces/DraftShape.md)[]

***

### getHandleHover()

> **getHandleHover**(): `object`

Defined in: [store/drawingStore.ts:121](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L121)

#### Returns

`object`

##### behavior

> **behavior**: [`HandleBehavior`](../type-aliases/HandleBehavior.md) \| `null`

##### handleId

> **handleId**: `string` \| `null`

***

### getHandles()

> **getHandles**(): [`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]

Defined in: [store/drawingStore.ts:117](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L117)

#### Returns

[`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]

***

### getOrderedShapes()

> **getOrderedShapes**(): [`Shape`](../interfaces/Shape.md)[]

Defined in: [store/drawingStore.ts:287](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L287)

Get shapes sorted by z-index. Uses cached result when possible.
The cache is invalidated when shapes are added, deleted, or reordered.

#### Returns

[`Shape`](../interfaces/Shape.md)[]

***

### getRenderState()

> **getRenderState**(): `object`

Defined in: [store/drawingStore.ts:252](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L252)

Get the complete render state including merged shapes and dirty tracking.
This is the recommended method for UIs to use for rendering.
Returns base document shapes merged with drafts, ordered by z-index,
with dirty state that includes draft IDs.

#### Returns

`object`

##### dirtyState

> **dirtyState**: [`DirtyState`](../interfaces/DirtyState.md)

##### shapes

> **shapes**: [`Shape`](../interfaces/Shape.md)[]

***

### getSelection()

> **getSelection**(): [`SelectionState`](../interfaces/SelectionState.md)

Defined in: [store/drawingStore.ts:317](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L317)

#### Returns

[`SelectionState`](../interfaces/SelectionState.md)

***

### getSelectionFrame()

> **getSelectionFrame**(): [`Bounds`](../interfaces/Bounds.md) \| `null`

Defined in: [store/drawingStore.ts:128](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L128)

#### Returns

[`Bounds`](../interfaces/Bounds.md) \| `null`

***

### getShapeHandlers()

> **getShapeHandlers**(): [`ShapeHandlerRegistry`](ShapeHandlerRegistry.md)

Defined in: [store/drawingStore.ts:383](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L383)

#### Returns

[`ShapeHandlerRegistry`](ShapeHandlerRegistry.md)

***

### getSharedSettings()

> **getSharedSettings**(): [`SharedToolSettings`](../interfaces/SharedToolSettings.md)

Defined in: [store/drawingStore.ts:301](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L301)

#### Returns

[`SharedToolSettings`](../interfaces/SharedToolSettings.md)

***

### mutateDocument()

> **mutateDocument**(`action`): `void`

Defined in: [store/drawingStore.ts:202](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L202)

#### Parameters

##### action

[`UndoableAction`](../interfaces/UndoableAction.md)

#### Returns

`void`

***

### redo()

> **redo**(): `boolean`

Defined in: [store/drawingStore.ts:365](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L365)

#### Returns

`boolean`

***

### setSelection()

> **setSelection**(`ids`, `primaryId?`): `void`

Defined in: [store/drawingStore.ts:324](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L324)

#### Parameters

##### ids

`Iterable`\<`string`\>

##### primaryId?

`string`

#### Returns

`void`

***

### toggleSelection()

> **toggleSelection**(`id`): `void`

Defined in: [store/drawingStore.ts:332](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L332)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### undo()

> **undo**(): `boolean`

Defined in: [store/drawingStore.ts:355](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L355)

#### Returns

`boolean`

***

### updateSharedSettings()

> **updateSharedSettings**\<`TSettings`\>(`updater`): `void`

Defined in: [store/drawingStore.ts:305](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L305)

#### Type Parameters

##### TSettings

`TSettings` = [`SharedToolSettings`](../interfaces/SharedToolSettings.md)

#### Parameters

##### updater

`Partial`\<`TSettings`\> | (`prev`) => `TSettings`

#### Returns

`void`
