[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UpdateShapeZIndex

# Class: UpdateShapeZIndex

Defined in: [actions/updateZIndex.ts:5](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateZIndex.ts#L5)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new UpdateShapeZIndex**(`shapeId`, `nextZIndex`): `UpdateShapeZIndex`

Defined in: [actions/updateZIndex.ts:9](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateZIndex.ts#L9)

#### Parameters

##### shapeId

`string`

##### nextZIndex

`string`

#### Returns

`UpdateShapeZIndex`

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [actions/updateZIndex.ts:31](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateZIndex.ts#L31)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectedShapeIds`](../interfaces/UndoableAction.md#affectedshapeids)

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [actions/updateZIndex.ts:35](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateZIndex.ts#L35)

#### Returns

`boolean`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectsZOrder`](../interfaces/UndoableAction.md#affectszorder)

***

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/updateZIndex.ts:14](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateZIndex.ts#L14)

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

Defined in: [actions/updateZIndex.ts:23](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/updateZIndex.ts#L23)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
