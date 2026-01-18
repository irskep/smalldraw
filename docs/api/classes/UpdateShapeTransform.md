[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UpdateShapeTransform

# Class: UpdateShapeTransform

Defined in: [actions/updateTransform.ts:6](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateTransform.ts#L6)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new UpdateShapeTransform**(`shapeId`, `nextTransform`): `UpdateShapeTransform`

Defined in: [actions/updateTransform.ts:10](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateTransform.ts#L10)

#### Parameters

##### shapeId

`string`

##### nextTransform

[`ShapeTransform`](../interfaces/ShapeTransform.md)

#### Returns

`UpdateShapeTransform`

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [actions/updateTransform.ts:32](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateTransform.ts#L32)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectedShapeIds`](../interfaces/UndoableAction.md#affectedshapeids)

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [actions/updateTransform.ts:36](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateTransform.ts#L36)

#### Returns

`boolean`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectsZOrder`](../interfaces/UndoableAction.md#affectszorder)

***

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/updateTransform.ts:15](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateTransform.ts#L15)

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

Defined in: [actions/updateTransform.ts:24](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateTransform.ts#L24)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
