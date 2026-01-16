[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UpdateShapeGeometry

# Class: UpdateShapeGeometry

Defined in: [actions/updateGeometry.ts:8](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateGeometry.ts#L8)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new UpdateShapeGeometry**(`shapeId`, `newGeometry`): `UpdateShapeGeometry`

Defined in: [actions/updateGeometry.ts:12](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateGeometry.ts#L12)

#### Parameters

##### shapeId

`string`

##### newGeometry

[`Geometry`](../type-aliases/Geometry.md)

#### Returns

`UpdateShapeGeometry`

## Methods

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/updateGeometry.ts:17](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateGeometry.ts#L17)

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

Defined in: [actions/updateGeometry.ts:29](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateGeometry.ts#L29)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
