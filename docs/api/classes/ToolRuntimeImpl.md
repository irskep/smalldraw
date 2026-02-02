[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ToolRuntimeImpl

# Class: ToolRuntimeImpl\<TOptions\>

Defined in: [core/src/tools/runtime.ts:35](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L35)

## Type Parameters

### TOptions

`TOptions` = `unknown`

## Implements

- [`ToolRuntime`](../interfaces/ToolRuntime.md)

## Constructors

### Constructor

> **new ToolRuntimeImpl**\<`TOptions`\>(`config`): `ToolRuntimeImpl`\<`TOptions`\>

Defined in: [core/src/tools/runtime.ts:49](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L49)

#### Parameters

##### config

`ToolRuntimeConfig`\<`TOptions`\>

#### Returns

`ToolRuntimeImpl`\<`TOptions`\>

## Properties

### toolId

> `readonly` **toolId**: `string`

Defined in: [core/src/tools/runtime.ts:36](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L36)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`toolId`](../interfaces/ToolRuntime.md#toolid)

## Methods

### clearDraft()

> **clearDraft**(): `void`

Defined in: [core/src/tools/runtime.ts:130](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L130)

Forcefully clear any draft state for this tool.

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`clearDraft`](../interfaces/ToolRuntime.md#cleardraft)

***

### clearSelection()

> **clearSelection**(): `void`

Defined in: [core/src/tools/runtime.ts:216](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L216)

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`clearSelection`](../interfaces/ToolRuntime.md#clearselection)

***

### clearToolState()

> **clearToolState**(): `void`

Defined in: [core/src/tools/runtime.ts:183](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L183)

#### Returns

`void`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`clearToolState`](../interfaces/ToolRuntime.md#cleartoolstate)

***

### commit()

> **commit**(`action`): `void`

Defined in: [core/src/tools/runtime.ts:135](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L135)

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

Defined in: [core/src/tools/runtime.ts:75](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L75)

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

Defined in: [core/src/tools/runtime.ts:233](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L233)

#### Returns

`void`

***

### emit()

> **emit**\<`TPayload`\>(`event`): `void`

Defined in: [core/src/tools/runtime.ts:81](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L81)

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

Defined in: [core/src/tools/runtime.ts:139](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L139)

Helpers for generating ids and z-index keys.

#### Parameters

##### prefix

`string` = `"shape"`

#### Returns

`string`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`generateShapeId`](../interfaces/ToolRuntime.md#generateshapeid)

***

### getDraft()

> **getDraft**(): [`DraftShape`](../interfaces/DraftShape.md) \| `null`

Defined in: [core/src/tools/runtime.ts:126](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L126)

#### Returns

[`DraftShape`](../interfaces/DraftShape.md) \| `null`

***

### getNextZIndex()

> **getNextZIndex**(): `string`

Defined in: [core/src/tools/runtime.ts:143](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L143)

#### Returns

`string`

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getNextZIndex`](../interfaces/ToolRuntime.md#getnextzindex)

***

### getOptions()

> **getOptions**\<`T`\>(): `T` \| `undefined`

Defined in: [core/src/tools/runtime.ts:149](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L149)

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

Defined in: [core/src/tools/runtime.ts:187](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L187)

Selection helpers

#### Returns

[`SelectionState`](../interfaces/SelectionState.md)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getSelection`](../interfaces/ToolRuntime.md#getselection)

***

### getShape()

> **getShape**(`shapeId`): [`AnyShape`](../type-aliases/AnyShape.md)

Defined in: [core/src/tools/runtime.ts:225](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L225)

#### Parameters

##### shapeId

`string`

#### Returns

[`AnyShape`](../type-aliases/AnyShape.md)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getShape`](../interfaces/ToolRuntime.md#getshape)

***

### getShapeHandlers()

> **getShapeHandlers**(): [`ShapeHandlerRegistry`](ShapeHandlerRegistry.md)

Defined in: [core/src/tools/runtime.ts:229](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L229)

Get the shape handler registry for this drawing session

#### Returns

[`ShapeHandlerRegistry`](ShapeHandlerRegistry.md)

#### Implementation of

[`ToolRuntime`](../interfaces/ToolRuntime.md).[`getShapeHandlers`](../interfaces/ToolRuntime.md#getshapehandlers)

***

### getSharedSettings()

> **getSharedSettings**\<`T`\>(): `T`

Defined in: [core/src/tools/runtime.ts:153](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L153)

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

Defined in: [core/src/tools/runtime.ts:168](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L168)

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

Defined in: [core/src/tools/runtime.ts:221](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L221)

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

Defined in: [core/src/tools/runtime.ts:63](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L63)

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

Defined in: [core/src/tools/runtime.ts:88](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L88)

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

Defined in: [core/src/tools/runtime.ts:104](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L104)

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

Defined in: [core/src/tools/runtime.ts:114](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L114)

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

Defined in: [core/src/tools/runtime.ts:194](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L194)

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

Defined in: [core/src/tools/runtime.ts:172](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L172)

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

Defined in: [core/src/tools/runtime.ts:201](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L201)

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

Defined in: [core/src/tools/runtime.ts:157](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L157)

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

Defined in: [core/src/tools/runtime.ts:176](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/runtime.ts#L176)

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
