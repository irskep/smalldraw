[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DrawingStore

# Class: DrawingStore

Defined in: [store/drawingStore.ts:33](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L33)

## Constructors

### Constructor

> **new DrawingStore**(`options`): `DrawingStore`

Defined in: [store/drawingStore.ts:61](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L61)

#### Parameters

##### options

[`DrawingStoreOptions`](../interfaces/DrawingStoreOptions.md)

#### Returns

`DrawingStore`

## Methods

### activateTool()

> **activateTool**(`toolId`): `void`

Defined in: [store/drawingStore.ts:74](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L74)

#### Parameters

##### toolId

`string`

#### Returns

`void`

***

### canRedo()

> **canRedo**(): `boolean`

Defined in: [store/drawingStore.ts:306](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L306)

#### Returns

`boolean`

***

### canUndo()

> **canUndo**(): `boolean`

Defined in: [store/drawingStore.ts:302](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L302)

#### Returns

`boolean`

***

### clearSelection()

> **clearSelection**(): `void`

Defined in: [store/drawingStore.ts:279](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L279)

#### Returns

`void`

***

### consumeDirtyState()

> **consumeDirtyState**(): [`DirtyState`](../interfaces/DirtyState.md)

Defined in: [store/drawingStore.ts:203](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L203)

Consume and clear the dirty state. Call this before rendering to get
the set of shapes that need updating.

#### Returns

[`DirtyState`](../interfaces/DirtyState.md)

***

### dispatch()

> **dispatch**(`event`, `payload`): `void`

Defined in: [store/drawingStore.ts:86](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L86)

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

Defined in: [store/drawingStore.ts:231](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L231)

#### Returns

`string` \| `null`

***

### getDocument()

> **getDocument**(): [`DrawingDocument`](../interfaces/DrawingDocument.md)

Defined in: [store/drawingStore.ts:213](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L213)

#### Returns

[`DrawingDocument`](../interfaces/DrawingDocument.md)

***

### getDrafts()

> **getDrafts**(): [`DraftShape`](../interfaces/DraftShape.md)[]

Defined in: [store/drawingStore.ts:92](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L92)

#### Returns

[`DraftShape`](../interfaces/DraftShape.md)[]

***

### getHandleHover()

> **getHandleHover**(): `object`

Defined in: [store/drawingStore.ts:100](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L100)

#### Returns

`object`

##### behavior

> **behavior**: [`HandleBehavior`](../type-aliases/HandleBehavior.md) \| `null`

##### handleId

> **handleId**: `string` \| `null`

***

### getHandles()

> **getHandles**(): [`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]

Defined in: [store/drawingStore.ts:96](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L96)

#### Returns

[`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]

***

### getOrderedShapes()

> **getOrderedShapes**(): [`Shape`](../interfaces/Shape.md)[]

Defined in: [store/drawingStore.ts:221](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L221)

Get shapes sorted by z-index. Uses cached result when possible.
The cache is invalidated when shapes are added, deleted, or reordered.

#### Returns

[`Shape`](../interfaces/Shape.md)[]

***

### getSelection()

> **getSelection**(): [`SelectionState`](../interfaces/SelectionState.md)

Defined in: [store/drawingStore.ts:250](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L250)

#### Returns

[`SelectionState`](../interfaces/SelectionState.md)

***

### getSelectionFrame()

> **getSelectionFrame**(): [`Bounds`](../interfaces/Bounds.md) \| `null`

Defined in: [store/drawingStore.ts:107](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L107)

#### Returns

[`Bounds`](../interfaces/Bounds.md) \| `null`

***

### getSharedSettings()

> **getSharedSettings**(): [`SharedToolSettings`](../interfaces/SharedToolSettings.md)

Defined in: [store/drawingStore.ts:235](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L235)

#### Returns

[`SharedToolSettings`](../interfaces/SharedToolSettings.md)

***

### mutateDocument()

> **mutateDocument**(`action`): `void`

Defined in: [store/drawingStore.ts:170](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L170)

#### Parameters

##### action

[`UndoableAction`](../interfaces/UndoableAction.md)

#### Returns

`void`

***

### redo()

> **redo**(): `boolean`

Defined in: [store/drawingStore.ts:293](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L293)

#### Returns

`boolean`

***

### setSelection()

> **setSelection**(`ids`, `primaryId?`): `void`

Defined in: [store/drawingStore.ts:257](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L257)

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

Defined in: [store/drawingStore.ts:264](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L264)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### undo()

> **undo**(): `boolean`

Defined in: [store/drawingStore.ts:284](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L284)

#### Returns

`boolean`

***

### updateSharedSettings()

> **updateSharedSettings**\<`TSettings`\>(`updater`): `void`

Defined in: [store/drawingStore.ts:239](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L239)

#### Type Parameters

##### TSettings

`TSettings` = [`SharedToolSettings`](../interfaces/SharedToolSettings.md)

#### Parameters

##### updater

`Partial`\<`TSettings`\> | (`prev`) => `TSettings`

#### Returns

`void`
