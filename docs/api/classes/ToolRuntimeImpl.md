[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ToolRuntimeImpl

# Class: ToolRuntimeImpl\<TOptions\>

Defined in: [tools/runtime.ts:33](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L33)

## Type Parameters

### TOptions

`TOptions` = `unknown`

## Implements

- [`ToolRuntime`](../interfaces/ToolRuntime.md)

## Constructors

### Constructor

> **new ToolRuntimeImpl**\<`TOptions`\>(`config`): `ToolRuntimeImpl`\<`TOptions`\>

Defined in: [tools/runtime.ts:49](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L49)

#### Parameters

##### config

`ToolRuntimeConfig`\<`TOptions`\>

#### Returns

`ToolRuntimeImpl`\<`TOptions`\>

## Properties

### toolId

> `readonly` **toolId**: `string`

Defined in: [tools/runtime.ts:36](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L36)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`toolId`](../interfaces/ToolRuntime.md#toolid)

## Methods

### clearDraft()

> **clearDraft**(): `void`

Defined in: [tools/runtime.ts:125](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L125)

Forcefully clear any draft state for this tool.

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`clearDraft`](../interfaces/ToolRuntime.md#cleardraft)

***

### clearSelection()

> **clearSelection**(): `void`

Defined in: [tools/runtime.ts:212](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L212)

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`clearSelection`](../interfaces/ToolRuntime.md#clearselection)

***

### clearToolState()

> **clearToolState**(): `void`

Defined in: [tools/runtime.ts:179](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L179)

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`clearToolState`](../interfaces/ToolRuntime.md#cleartoolstate)

***

### commit()

> **commit**(`action`): `void`

Defined in: [tools/runtime.ts:130](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L130)

Queue an undoable action to mutate the document.

#### Parameters

##### action

[`UndoableAction`](../interfaces/UndoableAction.md)

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`commit`](../interfaces/ToolRuntime.md#commit)

***

### dispatch()

> **dispatch**(`event`, `payload`): `void`

Defined in: [tools/runtime.ts:75](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L75)

#### Parameters

##### event

[`ToolEventName`](../type-aliases/ToolEventName.md)

##### payload

[`ToolPointerEvent`](../interfaces/ToolPointerEvent.md)

#### Returns

`void`

***

### dispose()

> **dispose**(): `void`

Defined in: [tools/runtime.ts:225](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L225)

#### Returns

`void`

***

### emit()

> **emit**\<`TPayload`\>(`event`): `void`

Defined in: [tools/runtime.ts:79](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L79)

#### Type Parameters

##### TPayload

`TPayload`

#### Parameters

##### event

[`ToolRuntimeEvent`](../type-aliases/ToolRuntimeEvent.md)\<`TPayload`\>

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`emit`](../interfaces/ToolRuntime.md#emit)

***

### generateShapeId()

> **generateShapeId**(`prefix`): `string`

Defined in: [tools/runtime.ts:134](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L134)

Helpers for generating ids and z-index keys.

#### Parameters

##### prefix

`string` = `'shape'`

#### Returns

`string`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`generateShapeId`](../interfaces/ToolRuntime.md#generateshapeid)

***

### getDraft()

> **getDraft**(): [`DraftShape`](../interfaces/DraftShape.md) \| `null`

Defined in: [tools/runtime.ts:121](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L121)

#### Returns

[`DraftShape`](../interfaces/DraftShape.md) \| `null`

***

### getNextZIndex()

> **getNextZIndex**(): `string`

Defined in: [tools/runtime.ts:139](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L139)

#### Returns

`string`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getNextZIndex`](../interfaces/ToolRuntime.md#getnextzindex)

***

### getOptions()

> **getOptions**\<`T`\>(): `T` \| `undefined`

Defined in: [tools/runtime.ts:145](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L145)

Access tool configuration or settings passed in by the host application.

#### Type Parameters

##### T

`T` = `TOptions`

#### Returns

`T` \| `undefined`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getOptions`](../interfaces/ToolRuntime.md#getoptions)

***

### getSelection()

> **getSelection**(): [`SelectionState`](../interfaces/SelectionState.md)

Defined in: [tools/runtime.ts:183](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L183)

Selection helpers

#### Returns

[`SelectionState`](../interfaces/SelectionState.md)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getSelection`](../interfaces/ToolRuntime.md#getselection)

***

### getShape()

> **getShape**(`shapeId`): [`Shape`](../interfaces/Shape.md)

Defined in: [tools/runtime.ts:221](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L221)

#### Parameters

##### shapeId

`string`

#### Returns

[`Shape`](../interfaces/Shape.md)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getShape`](../interfaces/ToolRuntime.md#getshape)

***

### getSharedSettings()

> **getSharedSettings**\<`T`\>(): `T`

Defined in: [tools/runtime.ts:149](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L149)

Access shared drawing settings (stroke color/width, fill color, etc.).

#### Type Parameters

##### T

`T` = [`SharedToolSettings`](../interfaces/SharedToolSettings.md)

#### Returns

`T`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getSharedSettings`](../interfaces/ToolRuntime.md#getsharedsettings)

***

### getToolState()

> **getToolState**\<`TState`\>(): `TState` \| `undefined`

Defined in: [tools/runtime.ts:164](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L164)

Access tool-specific state persisted across activations.

#### Type Parameters

##### TState

`TState` = `unknown`

#### Returns

`TState` \| `undefined`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getToolState`](../interfaces/ToolRuntime.md#gettoolstate)

***

### isSelected()

> **isSelected**(`id`): `boolean`

Defined in: [tools/runtime.ts:217](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L217)

#### Parameters

##### id

`string`

#### Returns

`boolean`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`isSelected`](../interfaces/ToolRuntime.md#isselected)

***

### on()

> **on**(`event`, `handler`): () => `void`

Defined in: [tools/runtime.ts:63](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L63)

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

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`on`](../interfaces/ToolRuntime.md#on)

***

### onEvent()

> **onEvent**\<`TPayload`\>(`type`, `listener`): () => `void`

Defined in: [tools/runtime.ts:84](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L84)

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

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`onEvent`](../interfaces/ToolRuntime.md#onevent)

***

### setDraft()

> **setDraft**(`shape`): `void`

Defined in: [tools/runtime.ts:99](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L99)

Replace or clear the draft shape for this tool.

#### Parameters

##### shape

[`DraftShape`](../interfaces/DraftShape.md) | `null`

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`setDraft`](../interfaces/ToolRuntime.md#setdraft)

***

### setDrafts()

> **setDrafts**(`shapes`): `void`

Defined in: [tools/runtime.ts:109](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L109)

Replace or clear multiple draft shapes for this tool.

#### Parameters

##### shapes

[`DraftShape`](../interfaces/DraftShape.md)[]

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`setDrafts`](../interfaces/ToolRuntime.md#setdrafts)

***

### setSelection()

> **setSelection**(`ids`, `primaryId?`): `void`

Defined in: [tools/runtime.ts:190](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L190)

#### Parameters

##### ids

`Iterable`\<`string`\>

##### primaryId?

`string`

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`setSelection`](../interfaces/ToolRuntime.md#setselection)

***

### setToolState()

> **setToolState**\<`TState`\>(`state`): `void`

Defined in: [tools/runtime.ts:168](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L168)

#### Type Parameters

##### TState

`TState` = `unknown`

#### Parameters

##### state

`TState`

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`setToolState`](../interfaces/ToolRuntime.md#settoolstate)

***

### toggleSelection()

> **toggleSelection**(`id`): `void`

Defined in: [tools/runtime.ts:197](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L197)

#### Parameters

##### id

`string`

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`toggleSelection`](../interfaces/ToolRuntime.md#toggleselection)

***

### updateSharedSettings()

> **updateSharedSettings**\<`T`\>(`updater`): `void`

Defined in: [tools/runtime.ts:153](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L153)

#### Type Parameters

##### T

`T` = [`SharedToolSettings`](../interfaces/SharedToolSettings.md)

#### Parameters

##### updater

`Partial`\<`T`\> | (`prev`) => `T`

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`updateSharedSettings`](../interfaces/ToolRuntime.md#updatesharedsettings)

***

### updateToolState()

> **updateToolState**\<`TState`\>(`updater`): `void`

Defined in: [tools/runtime.ts:172](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/runtime.ts#L172)

#### Type Parameters

##### TState

`TState` = `unknown`

#### Parameters

##### updater

(`prev`) => `TState`

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`updateToolState`](../interfaces/ToolRuntime.md#updatetoolstate)
