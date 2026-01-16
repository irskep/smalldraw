[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / AddShape

# Class: AddShape

Defined in: [actions/addShape.ts:6](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/addShape.ts#L6)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new AddShape**(`shape`): `AddShape`

Defined in: [actions/addShape.ts:9](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/addShape.ts#L9)

#### Parameters

##### shape

[`Shape`](../interfaces/Shape.md)

#### Returns

`AddShape`

## Methods

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/addShape.ts:13](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/addShape.ts#L13)

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

Defined in: [actions/addShape.ts:17](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/addShape.ts#L17)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
