[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DragCallbacks

# Interface: DragCallbacks\<TState\>

Defined in: [tools/pointerDrag.ts:4](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/pointerDrag.ts#L4)

## Type Parameters

### TState

`TState`

## Properties

### onCancel()?

> `optional` **onCancel**: (`state`, `runtime`) => `void`

Defined in: [tools/pointerDrag.ts:8](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/pointerDrag.ts#L8)

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

Defined in: [tools/pointerDrag.ts:7](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/pointerDrag.ts#L7)

#### Parameters

##### state

`TState`

##### point

[`Point`](Point.md)

##### event

[`PointerDragEvent`](PointerDragEvent.md)

##### runtime

[`ToolRuntime`](ToolRuntime.md)

#### Returns

`void`

***

### onMove()?

> `optional` **onMove**: (`state`, `point`, `event`, `runtime`) => `void`

Defined in: [tools/pointerDrag.ts:6](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/pointerDrag.ts#L6)

#### Parameters

##### state

`TState`

##### point

[`Point`](Point.md)

##### event

[`PointerDragEvent`](PointerDragEvent.md)

##### runtime

[`ToolRuntime`](ToolRuntime.md)

#### Returns

`void`

***

### onStart()

> **onStart**: (`point`, `event`, `runtime`) => `TState` \| `null`

Defined in: [tools/pointerDrag.ts:5](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/pointerDrag.ts#L5)

#### Parameters

##### point

[`Point`](Point.md)

##### event

[`PointerDragEvent`](PointerDragEvent.md)

##### runtime

[`ToolRuntime`](ToolRuntime.md)

#### Returns

`TState` \| `null`
