[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ToolRuntimeImpl

# Class: ToolRuntimeImpl\<TOptions\>

Defined in: [tools/runtime.ts:35](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L35)

## Type Parameters

### TOptions

`TOptions` = `unknown`

## Implements

- [`ToolRuntime`](../interfaces/ToolRuntime.md)

## Constructors

### Constructor

> **new ToolRuntimeImpl**\<`TOptions`\>(`config`): `ToolRuntimeImpl`\<`TOptions`\>

Defined in: [tools/runtime.ts:52](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L52)

#### Parameters

##### config

`ToolRuntimeConfig`\<`TOptions`\>

#### Returns

`ToolRuntimeImpl`\<`TOptions`\>

## Properties

### toolId

> `readonly` **toolId**: `string`

Defined in: [tools/runtime.ts:38](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L38)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`toolId`](../interfaces/ToolRuntime.md#toolid)

## Methods

### clearDraft()

> **clearDraft**(): `void`

Defined in: [tools/runtime.ts:129](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L129)

Forcefully clear any draft state for this tool.

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`clearDraft`](../interfaces/ToolRuntime.md#cleardraft)

***

### clearSelection()

> **clearSelection**(): `void`

Defined in: [tools/runtime.ts:217](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L217)

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`clearSelection`](../interfaces/ToolRuntime.md#clearselection)

***

### clearToolState()

> **clearToolState**(): `void`

Defined in: [tools/runtime.ts:184](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L184)

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`clearToolState`](../interfaces/ToolRuntime.md#cleartoolstate)

***

### commit()

> **commit**(`action`): `void`

Defined in: [tools/runtime.ts:134](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L134)

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

Defined in: [tools/runtime.ts:79](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L79)

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

Defined in: [tools/runtime.ts:234](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L234)

#### Returns

`void`

***

### emit()

> **emit**\<`TPayload`\>(`event`): `void`

Defined in: [tools/runtime.ts:83](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L83)

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

Defined in: [tools/runtime.ts:139](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L139)

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

Defined in: [tools/runtime.ts:125](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L125)

#### Returns

[`DraftShape`](../interfaces/DraftShape.md) \| `null`

***

### getNextZIndex()

> **getNextZIndex**(): `string`

Defined in: [tools/runtime.ts:144](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L144)

#### Returns

`string`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getNextZIndex`](../interfaces/ToolRuntime.md#getnextzindex)

***

### getOptions()

> **getOptions**\<`T`\>(): `T` \| `undefined`

Defined in: [tools/runtime.ts:150](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L150)

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

Defined in: [tools/runtime.ts:188](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L188)

Selection helpers

#### Returns

[`SelectionState`](../interfaces/SelectionState.md)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getSelection`](../interfaces/ToolRuntime.md#getselection)

***

### getShape()

> **getShape**(`shapeId`): [`Shape`](../interfaces/Shape.md)

Defined in: [tools/runtime.ts:226](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L226)

#### Parameters

##### shapeId

`string`

#### Returns

[`Shape`](../interfaces/Shape.md)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getShape`](../interfaces/ToolRuntime.md#getshape)

***

### getShapeHandlers()

> **getShapeHandlers**(): [`ShapeHandlerRegistry`](ShapeHandlerRegistry.md)

Defined in: [tools/runtime.ts:230](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L230)

Get the shape handler registry for this drawing session

#### Returns

[`ShapeHandlerRegistry`](ShapeHandlerRegistry.md)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getShapeHandlers`](../interfaces/ToolRuntime.md#getshapehandlers)

***

### getSharedSettings()

> **getSharedSettings**\<`T`\>(): `T`

Defined in: [tools/runtime.ts:154](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L154)

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

Defined in: [tools/runtime.ts:169](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L169)

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

Defined in: [tools/runtime.ts:222](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L222)

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

Defined in: [tools/runtime.ts:67](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L67)

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

Defined in: [tools/runtime.ts:88](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L88)

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

Defined in: [tools/runtime.ts:103](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L103)

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

Defined in: [tools/runtime.ts:113](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L113)

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

Defined in: [tools/runtime.ts:195](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L195)

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

Defined in: [tools/runtime.ts:173](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L173)

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

Defined in: [tools/runtime.ts:202](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L202)

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

Defined in: [tools/runtime.ts:158](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L158)

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

Defined in: [tools/runtime.ts:177](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/runtime.ts#L177)

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
