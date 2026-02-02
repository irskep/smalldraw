[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DrawingStore

# Class: DrawingStore

Defined in: [core/src/store/drawingStore.ts:58](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L58)

## Constructors

### Constructor

> **new DrawingStore**(`options`): `DrawingStore`

Defined in: [core/src/store/drawingStore.ts:99](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L99)

#### Parameters

##### options

[`DrawingStoreOptions`](../interfaces/DrawingStoreOptions.md)

#### Returns

`DrawingStore`

## Methods

### activateTool()

> **activateTool**(`toolId`): `void`

Defined in: [core/src/store/drawingStore.ts:122](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L122)

#### Parameters

##### toolId

`string`

#### Returns

`void`

***

### applyAction()

> **applyAction**(`action`): `void`

Defined in: [core/src/store/drawingStore.ts:248](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L248)

#### Parameters

##### action

[`UndoableAction`](../interfaces/UndoableAction.md)

#### Returns

`void`

***

### applyDocument()

> **applyDocument**(`nextDoc`): `void`

Defined in: [core/src/store/drawingStore.ts:252](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L252)

#### Parameters

##### nextDoc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

#### Returns

`void`

***

### canRedo()

> **canRedo**(): `boolean`

Defined in: [core/src/store/drawingStore.ts:490](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L490)

#### Returns

`boolean`

***

### canUndo()

> **canUndo**(): `boolean`

Defined in: [core/src/store/drawingStore.ts:486](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L486)

#### Returns

`boolean`

***

### clearSelection()

> **clearSelection**(): `void`

Defined in: [core/src/store/drawingStore.ts:422](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L422)

#### Returns

`void`

***

### consumeDirtyState()

> **consumeDirtyState**(): [`DirtyState`](../interfaces/DirtyState.md)

Defined in: [core/src/store/drawingStore.ts:309](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L309)

Consume and clear the dirty state. Call this before rendering to get
the set of shapes that need updating.

#### Returns

[`DirtyState`](../interfaces/DirtyState.md)

***

### dispatch()

> **dispatch**(`event`, `payload`): `void`

Defined in: [core/src/store/drawingStore.ts:135](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L135)

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

Defined in: [core/src/store/drawingStore.ts:370](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L370)

#### Returns

`string` \| `null`

***

### getDocument()

> **getDocument**(): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/store/drawingStore.ts:352](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L352)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

***

### getDrafts()

> **getDrafts**(): [`DraftShape`](../interfaces/DraftShape.md)[]

Defined in: [core/src/store/drawingStore.ts:142](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L142)

#### Returns

[`DraftShape`](../interfaces/DraftShape.md)[]

***

### getHandleHover()

> **getHandleHover**(): `object`

Defined in: [core/src/store/drawingStore.ts:150](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L150)

#### Returns

`object`

##### behavior

> **behavior**: [`HandleBehavior`](../type-aliases/HandleBehavior.md) \| `null`

##### handleId

> **handleId**: `string` \| `null`

***

### getHandles()

> **getHandles**(): [`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]

Defined in: [core/src/store/drawingStore.ts:146](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L146)

#### Returns

[`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]

***

### getOrderedShapes()

> **getOrderedShapes**(): [`Shape`](../interfaces/Shape.md)[]

Defined in: [core/src/store/drawingStore.ts:360](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L360)

Get shapes sorted by z-index. Uses cached result when possible.
The cache is invalidated when shapes are added, deleted, or reordered.

#### Returns

[`Shape`](../interfaces/Shape.md)[]

***

### getRenderState()

> **getRenderState**(): `object`

Defined in: [core/src/store/drawingStore.ts:325](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L325)

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

Defined in: [core/src/store/drawingStore.ts:390](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L390)

#### Returns

[`SelectionState`](../interfaces/SelectionState.md)

***

### getSelectionFrame()

> **getSelectionFrame**(): `Box` \| `null`

Defined in: [core/src/store/drawingStore.ts:157](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L157)

#### Returns

`Box` \| `null`

***

### getShapeHandlers()

> **getShapeHandlers**(): [`ShapeHandlerRegistry`](ShapeHandlerRegistry.md)

Defined in: [core/src/store/drawingStore.ts:494](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L494)

#### Returns

[`ShapeHandlerRegistry`](ShapeHandlerRegistry.md)

***

### getSharedSettings()

> **getSharedSettings**(): [`SharedToolSettings`](../interfaces/SharedToolSettings.md)

Defined in: [core/src/store/drawingStore.ts:374](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L374)

#### Returns

[`SharedToolSettings`](../interfaces/SharedToolSettings.md)

***

### mutateDocument()

> **mutateDocument**(`action`): `void`

Defined in: [core/src/store/drawingStore.ts:264](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L264)

#### Parameters

##### action

[`UndoableAction`](../interfaces/UndoableAction.md)

#### Returns

`void`

***

### redo()

> **redo**(): `boolean`

Defined in: [core/src/store/drawingStore.ts:457](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L457)

#### Returns

`boolean`

***

### setActionDispatcher()

> **setActionDispatcher**(`dispatcher?`): `void`

Defined in: [core/src/store/drawingStore.ts:242](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L242)

#### Parameters

##### dispatcher?

(`event`) => `void`

#### Returns

`void`

***

### setOnAction()

> **setOnAction**(`callback?`): `void`

Defined in: [core/src/store/drawingStore.ts:238](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L238)

#### Parameters

##### callback?

(`event`) => `void`

#### Returns

`void`

***

### setOnDocumentChanged()

> **setOnDocumentChanged**(`callback?`): `void`

Defined in: [core/src/store/drawingStore.ts:234](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L234)

#### Parameters

##### callback?

(`doc`) => `void`

#### Returns

`void`

***

### setOnRenderNeeded()

> **setOnRenderNeeded**(`callback?`): `void`

Defined in: [core/src/store/drawingStore.ts:230](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L230)

#### Parameters

##### callback?

() => `void`

#### Returns

`void`

***

### setSelection()

> **setSelection**(`ids`, `primaryId?`): `void`

Defined in: [core/src/store/drawingStore.ts:397](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L397)

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

Defined in: [core/src/store/drawingStore.ts:405](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L405)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### undo()

> **undo**(): `boolean`

Defined in: [core/src/store/drawingStore.ts:428](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L428)

#### Returns

`boolean`

***

### updateSharedSettings()

> **updateSharedSettings**\<`TSettings`\>(`updater`): `void`

Defined in: [core/src/store/drawingStore.ts:378](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L378)

#### Type Parameters

##### TSettings

`TSettings` = [`SharedToolSettings`](../interfaces/SharedToolSettings.md)

#### Parameters

##### updater

`Partial`\<`TSettings`\> | (`prev`) => `TSettings`

#### Returns

`void`
