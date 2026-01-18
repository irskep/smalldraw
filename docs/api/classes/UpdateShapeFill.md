[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UpdateShapeFill

# Class: UpdateShapeFill

Defined in: [actions/updateFill.ts:6](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/updateFill.ts#L6)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new UpdateShapeFill**(`shapeId`, `nextFill`): `UpdateShapeFill`

Defined in: [actions/updateFill.ts:10](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/updateFill.ts#L10)

#### Parameters

##### shapeId

`string`

##### nextFill

[`Fill`](../type-aliases/Fill.md) | `undefined`

#### Returns

`UpdateShapeFill`

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [actions/updateFill.ts:32](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/updateFill.ts#L32)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectedShapeIds`](../interfaces/UndoableAction.md#affectedshapeids)

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [actions/updateFill.ts:36](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/updateFill.ts#L36)

#### Returns

`boolean`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectsZOrder`](../interfaces/UndoableAction.md#affectszorder)

***

### redo()

> **redo**(`doc`, `ctx`): `void`

Defined in: [actions/updateFill.ts:15](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/updateFill.ts#L15)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`redo`](../interfaces/UndoableAction.md#redo)

***

### undo()

> **undo**(`doc`, `ctx`): `void`

Defined in: [actions/updateFill.ts:24](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/updateFill.ts#L24)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
