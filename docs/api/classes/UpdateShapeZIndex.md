[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UpdateShapeZIndex

# Class: UpdateShapeZIndex

Defined in: [core/src/actions/updateZIndex.ts:5](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateZIndex.ts#L5)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new UpdateShapeZIndex**(`shapeId`, `nextZIndex`): `UpdateShapeZIndex`

Defined in: [core/src/actions/updateZIndex.ts:9](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateZIndex.ts#L9)

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

Defined in: [core/src/actions/updateZIndex.ts:48](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateZIndex.ts#L48)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectedShapeIds`](../interfaces/UndoableAction.md#affectedshapeids)

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [core/src/actions/updateZIndex.ts:52](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateZIndex.ts#L52)

#### Returns

`boolean`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectsZOrder`](../interfaces/UndoableAction.md#affectszorder)

***

### redo()

> **redo**(`doc`, `ctx`): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/actions/updateZIndex.ts:14](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateZIndex.ts#L14)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`redo`](../interfaces/UndoableAction.md#redo)

***

### undo()

> **undo**(`doc`, `ctx`): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/actions/updateZIndex.ts:31](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateZIndex.ts#L31)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
