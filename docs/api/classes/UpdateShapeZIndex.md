[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UpdateShapeZIndex

# Class: UpdateShapeZIndex

Defined in: [actions/updateZIndex.ts:5](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateZIndex.ts#L5)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new UpdateShapeZIndex**(`shapeId`, `nextZIndex`): `UpdateShapeZIndex`

Defined in: [actions/updateZIndex.ts:9](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateZIndex.ts#L9)

#### Parameters

##### shapeId

`string`

##### nextZIndex

`string`

#### Returns

`UpdateShapeZIndex`

## Methods

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/updateZIndex.ts:14](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateZIndex.ts#L14)

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

Defined in: [actions/updateZIndex.ts:23](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/updateZIndex.ts#L23)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
