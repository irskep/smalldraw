[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UndoableAction

# Interface: UndoableAction

Defined in: [actions/types.ts:3](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/types.ts#L3)

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [actions/types.ts:7](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/types.ts#L7)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [actions/types.ts:8](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/types.ts#L8)

#### Returns

`boolean`

***

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/types.ts:4](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/types.ts#L4)

#### Parameters

##### doc

[`DrawingDocument`](DrawingDocument.md)

#### Returns

`void`

***

### undo()

> **undo**(`doc`): `void`

Defined in: [actions/types.ts:5](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/types.ts#L5)

#### Parameters

##### doc

[`DrawingDocument`](DrawingDocument.md)

#### Returns

`void`
