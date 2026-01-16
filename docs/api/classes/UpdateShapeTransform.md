[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UpdateShapeTransform

# Class: UpdateShapeTransform

Defined in: [actions/updateTransform.ts:6](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateTransform.ts#L6)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new UpdateShapeTransform**(`shapeId`, `nextTransform`): `UpdateShapeTransform`

Defined in: [actions/updateTransform.ts:10](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateTransform.ts#L10)

#### Parameters

##### shapeId

`string`

##### nextTransform

[`ShapeTransform`](../interfaces/ShapeTransform.md)

#### Returns

`UpdateShapeTransform`

## Methods

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/updateTransform.ts:15](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateTransform.ts#L15)

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

Defined in: [actions/updateTransform.ts:24](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateTransform.ts#L24)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
