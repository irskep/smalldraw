[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DrawingStore

# Class: DrawingStore

Defined in: [store/drawingStore.ts:24](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L24)

## Constructors

### Constructor

> **new DrawingStore**(`options`): `DrawingStore`

Defined in: [store/drawingStore.ts:41](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L41)

#### Parameters

##### options

[`DrawingStoreOptions`](../interfaces/DrawingStoreOptions.md)

#### Returns

`DrawingStore`

## Methods

### activateTool()

> **activateTool**(`toolId`): `void`

Defined in: [store/drawingStore.ts:54](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L54)

#### Parameters

##### toolId

`string`

#### Returns

`void`

***

### canRedo()

> **canRedo**(): `boolean`

Defined in: [store/drawingStore.ts:213](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L213)

#### Returns

`boolean`

***

### canUndo()

> **canUndo**(): `boolean`

Defined in: [store/drawingStore.ts:209](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L209)

#### Returns

`boolean`

***

### clearSelection()

> **clearSelection**(): `void`

Defined in: [store/drawingStore.ts:196](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L196)

#### Returns

`void`

***

### dispatch()

> **dispatch**(`event`, `payload`): `void`

Defined in: [store/drawingStore.ts:66](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L66)

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

Defined in: [store/drawingStore.ts:148](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L148)

#### Returns

`string` \| `null`

***

### getDocument()

> **getDocument**(): [`DrawingDocument`](../interfaces/DrawingDocument.md)

Defined in: [store/drawingStore.ts:144](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L144)

#### Returns

[`DrawingDocument`](../interfaces/DrawingDocument.md)

***

### getDrafts()

> **getDrafts**(): [`DraftShape`](../interfaces/DraftShape.md)[]

Defined in: [store/drawingStore.ts:72](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L72)

#### Returns

[`DraftShape`](../interfaces/DraftShape.md)[]

***

### getHandleHover()

> **getHandleHover**(): `object`

Defined in: [store/drawingStore.ts:80](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L80)

#### Returns

`object`

##### behavior

> **behavior**: [`HandleBehavior`](../type-aliases/HandleBehavior.md) \| `null`

##### handleId

> **handleId**: `string` \| `null`

***

### getHandles()

> **getHandles**(): [`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]

Defined in: [store/drawingStore.ts:76](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L76)

#### Returns

[`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]

***

### getSelection()

> **getSelection**(): [`SelectionState`](../interfaces/SelectionState.md)

Defined in: [store/drawingStore.ts:167](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L167)

#### Returns

[`SelectionState`](../interfaces/SelectionState.md)

***

### getSelectionFrame()

> **getSelectionFrame**(): [`Bounds`](../interfaces/Bounds.md) \| `null`

Defined in: [store/drawingStore.ts:84](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L84)

#### Returns

[`Bounds`](../interfaces/Bounds.md) \| `null`

***

### getSharedSettings()

> **getSharedSettings**(): [`SharedToolSettings`](../interfaces/SharedToolSettings.md)

Defined in: [store/drawingStore.ts:152](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L152)

#### Returns

[`SharedToolSettings`](../interfaces/SharedToolSettings.md)

***

### mutateDocument()

> **mutateDocument**(`action`): `void`

Defined in: [store/drawingStore.ts:140](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L140)

#### Parameters

##### action

[`UndoableAction`](../interfaces/UndoableAction.md)

#### Returns

`void`

***

### redo()

> **redo**(): `boolean`

Defined in: [store/drawingStore.ts:205](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L205)

#### Returns

`boolean`

***

### setSelection()

> **setSelection**(`ids`, `primaryId?`): `void`

Defined in: [store/drawingStore.ts:174](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L174)

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

Defined in: [store/drawingStore.ts:181](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L181)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### undo()

> **undo**(): `boolean`

Defined in: [store/drawingStore.ts:201](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L201)

#### Returns

`boolean`

***

### updateSharedSettings()

> **updateSharedSettings**\<`TSettings`\>(`updater`): `void`

Defined in: [store/drawingStore.ts:156](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/store/drawingStore.ts#L156)

#### Type Parameters

##### TSettings

`TSettings` = [`SharedToolSettings`](../interfaces/SharedToolSettings.md)

#### Parameters

##### updater

`Partial`\<`TSettings`\> | (`prev`) => `TSettings`

#### Returns

`void`
