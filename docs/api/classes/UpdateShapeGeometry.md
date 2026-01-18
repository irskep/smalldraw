[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UpdateShapeGeometry

# Class: UpdateShapeGeometry

Defined in: [actions/updateGeometry.ts:8](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateGeometry.ts#L8)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new UpdateShapeGeometry**(`shapeId`, `newGeometry`): `UpdateShapeGeometry`

Defined in: [actions/updateGeometry.ts:12](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateGeometry.ts#L12)

#### Parameters

##### shapeId

`string`

##### newGeometry

[`Geometry`](../type-aliases/Geometry.md)

#### Returns

`UpdateShapeGeometry`

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [actions/updateGeometry.ts:40](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateGeometry.ts#L40)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectedShapeIds`](../interfaces/UndoableAction.md#affectedshapeids)

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [actions/updateGeometry.ts:44](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateGeometry.ts#L44)

#### Returns

`boolean`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectsZOrder`](../interfaces/UndoableAction.md#affectszorder)

***

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/updateGeometry.ts:17](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateGeometry.ts#L17)

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

Defined in: [actions/updateGeometry.ts:29](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateGeometry.ts#L29)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
