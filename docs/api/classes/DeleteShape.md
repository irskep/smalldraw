[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DeleteShape

# Class: DeleteShape

Defined in: [actions/deleteShape.ts:5](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/deleteShape.ts#L5)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new DeleteShape**(`shapeId`): `DeleteShape`

Defined in: [actions/deleteShape.ts:8](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/deleteShape.ts#L8)

#### Parameters

##### shapeId

`string`

#### Returns

`DeleteShape`

## Methods

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/deleteShape.ts:10](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/deleteShape.ts#L10)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`redo`](../interfaces/UndoableAction.md#redo)

***

### undo()

> **undo**(`doc`): `void`

Defined in: [actions/deleteShape.ts:17](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/deleteShape.ts#L17)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
