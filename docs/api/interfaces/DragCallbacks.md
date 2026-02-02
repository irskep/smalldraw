[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DragCallbacks

# Interface: DragCallbacks\<TState\>

Defined in: [core/src/tools/pointerDrag.ts:4](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/pointerDrag.ts#L4)

## Type Parameters

### TState

`TState`

## Properties

### onCancel()?

> `optional` **onCancel**: (`state`, `runtime`) => `void`

Defined in: [core/src/tools/pointerDrag.ts:22](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/pointerDrag.ts#L22)

#### Parameters

##### state

`TState` | `null`

##### runtime

[`ToolRuntime`](ToolRuntime.md)

#### Returns

`void`

***

### onEnd()?

> `optional` **onEnd**: (`state`, `point`, `event`, `runtime`) => `void`

Defined in: [core/src/tools/pointerDrag.ts:16](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/pointerDrag.ts#L16)

#### Parameters

##### state

`TState`

##### point

`Vec2`

##### event

[`PointerDragEvent`](PointerDragEvent.md)

##### runtime

[`ToolRuntime`](ToolRuntime.md)

#### Returns

`void`

***

### onMove()?

> `optional` **onMove**: (`state`, `point`, `event`, `runtime`) => `void`

Defined in: [core/src/tools/pointerDrag.ts:10](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/pointerDrag.ts#L10)

#### Parameters

##### state

`TState`

##### point

`Vec2`

##### event

[`PointerDragEvent`](PointerDragEvent.md)

##### runtime

[`ToolRuntime`](ToolRuntime.md)

#### Returns

`void`

***

### onStart()

> **onStart**: (`point`, `event`, `runtime`) => `TState` \| `null`

Defined in: [core/src/tools/pointerDrag.ts:5](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/pointerDrag.ts#L5)

#### Parameters

##### point

`Vec2`

##### event

[`PointerDragEvent`](PointerDragEvent.md)

##### runtime

[`ToolRuntime`](ToolRuntime.md)

#### Returns

`TState` \| `null`
