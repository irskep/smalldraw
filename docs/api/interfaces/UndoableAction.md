[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UndoableAction

# Interface: UndoableAction

Defined in: [core/src/actions/types.ts:12](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/types.ts#L12)

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [core/src/actions/types.ts:16](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/types.ts#L16)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [core/src/actions/types.ts:17](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/types.ts#L17)

#### Returns

`boolean`

***

### redo()

> **redo**(`doc`, `ctx`): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/actions/types.ts:13](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/types.ts#L13)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](ActionContext.md)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

***

### undo()

> **undo**(`doc`, `ctx`): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/actions/types.ts:14](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/types.ts#L14)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](ActionContext.md)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)
