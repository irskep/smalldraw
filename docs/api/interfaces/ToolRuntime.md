[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ToolRuntime

# Interface: ToolRuntime

Defined in: [core/src/tools/types.ts:40](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L40)

## Properties

### toolId

> **toolId**: `string`

Defined in: [core/src/tools/types.ts:41](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L41)

## Methods

### clearDraft()

> **clearDraft**(): `void`

Defined in: [core/src/tools/types.ts:49](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L49)

Forcefully clear any draft state for this tool.

#### Returns

`void`

***

### clearSelection()

> **clearSelection**(): `void`

Defined in: [core/src/tools/types.ts:73](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L73)

#### Returns

`void`

***

### clearToolState()

> **clearToolState**(): `void`

Defined in: [core/src/tools/types.ts:68](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L68)

#### Returns

`void`

***

### commit()

> **commit**(`action`): `void`

Defined in: [core/src/tools/types.ts:51](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L51)

Queue an undoable action to mutate the document.

#### Parameters

##### action

[`UndoableAction`](UndoableAction.md)

#### Returns

`void`

***

### emit()

> **emit**\<`TPayload`\>(`event`): `void`

Defined in: [core/src/tools/types.ts:82](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L82)

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

Defined in: [core/src/tools/types.ts:53](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L53)

Helpers for generating ids and z-index keys.

#### Parameters

##### prefix?

`string`

#### Returns

`string`

***

### getNextZIndex()

> **getNextZIndex**(): `string`

Defined in: [core/src/tools/types.ts:54](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L54)

#### Returns

`string`

***

### getOptions()

> **getOptions**\<`TOptions`\>(): `TOptions` \| `undefined`

Defined in: [core/src/tools/types.ts:56](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L56)

Access tool configuration or settings passed in by the host application.

#### Type Parameters

##### TOptions

`TOptions` = `Record`\<`string`, `unknown`\>

#### Returns

`TOptions` \| `undefined`

***

### getSelection()

> **getSelection**(): [`SelectionState`](SelectionState.md)

Defined in: [core/src/tools/types.ts:70](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L70)

Selection helpers

#### Returns

[`SelectionState`](SelectionState.md)

***

### getShape()

> **getShape**(`shapeId`): [`AnyShape`](../type-aliases/AnyShape.md) \| `undefined`

Defined in: [core/src/tools/types.ts:75](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L75)

#### Parameters

##### shapeId

`string`

#### Returns

[`AnyShape`](../type-aliases/AnyShape.md) \| `undefined`

***

### getShapeHandlers()

> **getShapeHandlers**(): [`ShapeHandlerRegistry`](../classes/ShapeHandlerRegistry.md)

Defined in: [core/src/tools/types.ts:77](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L77)

Get the shape handler registry for this drawing session

#### Returns

[`ShapeHandlerRegistry`](../classes/ShapeHandlerRegistry.md)

***

### getSharedSettings()

> **getSharedSettings**\<`TSettings`\>(): `TSettings`

Defined in: [core/src/tools/types.ts:58](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L58)

Access shared drawing settings (stroke color/width, fill color, etc.).

#### Type Parameters

##### TSettings

`TSettings` = [`SharedToolSettings`](SharedToolSettings.md)

#### Returns

`TSettings`

***

### getToolState()

> **getToolState**\<`TState`\>(): `TState` \| `undefined`

Defined in: [core/src/tools/types.ts:63](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L63)

Access tool-specific state persisted across activations.

#### Type Parameters

##### TState

`TState` = `unknown`

#### Returns

`TState` \| `undefined`

***

### isSelected()

> **isSelected**(`id`): `boolean`

Defined in: [core/src/tools/types.ts:74](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L74)

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### on()

> **on**(`event`, `handler`): () => `void`

Defined in: [core/src/tools/types.ts:43](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L43)

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

Defined in: [core/src/tools/types.ts:78](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L78)

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

Defined in: [core/src/tools/types.ts:45](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L45)

Replace or clear the draft shape for this tool.

#### Parameters

##### shape

[`DraftShape`](DraftShape.md) | `null`

#### Returns

`void`

***

### setDrafts()

> **setDrafts**(`shapes`): `void`

Defined in: [core/src/tools/types.ts:47](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L47)

Replace or clear multiple draft shapes for this tool.

#### Parameters

##### shapes

[`DraftShape`](DraftShape.md)[]

#### Returns

`void`

***

### setSelection()

> **setSelection**(`ids`, `primaryId?`): `void`

Defined in: [core/src/tools/types.ts:71](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L71)

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

Defined in: [core/src/tools/types.ts:64](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L64)

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

Defined in: [core/src/tools/types.ts:72](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L72)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### updateSharedSettings()

> **updateSharedSettings**\<`TSettings`\>(`updater`): `void`

Defined in: [core/src/tools/types.ts:59](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L59)

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

Defined in: [core/src/tools/types.ts:65](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L65)

#### Type Parameters

##### TState

`TState` = `unknown`

#### Parameters

##### updater

(`prev`) => `TState`

#### Returns

`void`
