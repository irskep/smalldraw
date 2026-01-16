[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ToolRuntime

# Interface: ToolRuntime

Defined in: [tools/types.ts:41](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L41)

## Properties

### toolId

> **toolId**: `string`

Defined in: [tools/types.ts:42](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L42)

## Methods

### clearDraft()

> **clearDraft**(): `void`

Defined in: [tools/types.ts:50](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L50)

Forcefully clear any draft state for this tool.

#### Returns

`void`

***

### clearSelection()

> **clearSelection**(): `void`

Defined in: [tools/types.ts:74](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L74)

#### Returns

`void`

***

### clearToolState()

> **clearToolState**(): `void`

Defined in: [tools/types.ts:69](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L69)

#### Returns

`void`

***

### commit()

> **commit**(`action`): `void`

Defined in: [tools/types.ts:52](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L52)

Queue an undoable action to mutate the document.

#### Parameters

##### action

[`UndoableAction`](UndoableAction.md)

#### Returns

`void`

***

### emit()

> **emit**\<`TPayload`\>(`event`): `void`

Defined in: [tools/types.ts:81](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L81)

#### Type Parameters

##### TPayload

`TPayload`

#### Parameters

##### event

[`ToolRuntimeEvent`](../type-aliases/ToolRuntimeEvent.md)\<`TPayload`\>

#### Returns

`void`

***

### generateShapeId()

> **generateShapeId**(`prefix?`): `string`

Defined in: [tools/types.ts:54](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L54)

Helpers for generating ids and z-index keys.

#### Parameters

##### prefix?

`string`

#### Returns

`string`

***

### getNextZIndex()

> **getNextZIndex**(): `string`

Defined in: [tools/types.ts:55](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L55)

#### Returns

`string`

***

### getOptions()

> **getOptions**\<`TOptions`\>(): `TOptions` \| `undefined`

Defined in: [tools/types.ts:57](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L57)

Access tool configuration or settings passed in by the host application.

#### Type Parameters

##### TOptions

`TOptions` = `Record`\<`string`, `unknown`\>

#### Returns

`TOptions` \| `undefined`

***

### getSelection()

> **getSelection**(): [`SelectionState`](SelectionState.md)

Defined in: [tools/types.ts:71](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L71)

Selection helpers

#### Returns

[`SelectionState`](SelectionState.md)

***

### getShape()

> **getShape**(`shapeId`): [`Shape`](Shape.md) \| `undefined`

Defined in: [tools/types.ts:76](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L76)

#### Parameters

##### shapeId

`string`

#### Returns

[`Shape`](Shape.md) \| `undefined`

***

### getSharedSettings()

> **getSharedSettings**\<`TSettings`\>(): `TSettings`

Defined in: [tools/types.ts:59](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L59)

Access shared drawing settings (stroke color/width, fill color, etc.).

#### Type Parameters

##### TSettings

`TSettings` = [`SharedToolSettings`](SharedToolSettings.md)

#### Returns

`TSettings`

***

### getToolState()

> **getToolState**\<`TState`\>(): `TState` \| `undefined`

Defined in: [tools/types.ts:64](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L64)

Access tool-specific state persisted across activations.

#### Type Parameters

##### TState

`TState` = `unknown`

#### Returns

`TState` \| `undefined`

***

### isSelected()

> **isSelected**(`id`): `boolean`

Defined in: [tools/types.ts:75](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L75)

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### on()

> **on**(`event`, `handler`): () => `void`

Defined in: [tools/types.ts:44](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L44)

Register an event handler. Returns a disposer to detach the handler.

#### Parameters

##### event

[`ToolEventName`](../type-aliases/ToolEventName.md)

##### handler

[`ToolEventHandler`](../type-aliases/ToolEventHandler.md)

#### Returns

> (): `void`

##### Returns

`void`

***

### onEvent()

> **onEvent**\<`TPayload`\>(`type`, `listener`): () => `void`

Defined in: [tools/types.ts:77](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L77)

#### Type Parameters

##### TPayload

`TPayload`

#### Parameters

##### type

`"handles"` | `"handle-hover"` | `"selection-frame"` | `"custom"`

##### listener

(`payload`) => `void`

#### Returns

> (): `void`

##### Returns

`void`

***

### setDraft()

> **setDraft**(`shape`): `void`

Defined in: [tools/types.ts:46](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L46)

Replace or clear the draft shape for this tool.

#### Parameters

##### shape

[`DraftShape`](DraftShape.md) | `null`

#### Returns

`void`

***

### setDrafts()

> **setDrafts**(`shapes`): `void`

Defined in: [tools/types.ts:48](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L48)

Replace or clear multiple draft shapes for this tool.

#### Parameters

##### shapes

[`DraftShape`](DraftShape.md)[]

#### Returns

`void`

***

### setSelection()

> **setSelection**(`ids`, `primaryId?`): `void`

Defined in: [tools/types.ts:72](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L72)

#### Parameters

##### ids

`Iterable`\<`string`\>

##### primaryId?

`string`

#### Returns

`void`

***

### setToolState()

> **setToolState**\<`TState`\>(`state`): `void`

Defined in: [tools/types.ts:65](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L65)

#### Type Parameters

##### TState

`TState` = `unknown`

#### Parameters

##### state

`TState`

#### Returns

`void`

***

### toggleSelection()

> **toggleSelection**(`id`): `void`

Defined in: [tools/types.ts:73](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L73)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### updateSharedSettings()

> **updateSharedSettings**\<`TSettings`\>(`updater`): `void`

Defined in: [tools/types.ts:60](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L60)

#### Type Parameters

##### TSettings

`TSettings` = [`SharedToolSettings`](SharedToolSettings.md)

#### Parameters

##### updater

`Partial`\<`TSettings`\> | (`prev`) => `TSettings`

#### Returns

`void`

***

### updateToolState()

> **updateToolState**\<`TState`\>(`updater`): `void`

Defined in: [tools/types.ts:66](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L66)

#### Type Parameters

##### TState

`TState` = `unknown`

#### Parameters

##### updater

(`prev`) => `TState`

#### Returns

`void`
