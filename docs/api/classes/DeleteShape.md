[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DeleteShape

# Class: DeleteShape

Defined in: [core/src/actions/deleteShape.ts:6](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/deleteShape.ts#L6)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new DeleteShape**(`shapeId`): `DeleteShape`

Defined in: [core/src/actions/deleteShape.ts:9](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/deleteShape.ts#L9)

#### Parameters

##### shapeId

`string`

#### Returns

`DeleteShape`

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [core/src/actions/deleteShape.ts:33](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/deleteShape.ts#L33)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectedShapeIds`](../interfaces/UndoableAction.md#affectedshapeids)

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [core/src/actions/deleteShape.ts:37](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/deleteShape.ts#L37)

#### Returns

`boolean`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectsZOrder`](../interfaces/UndoableAction.md#affectszorder)

***

### redo()

> **redo**(`doc`, `ctx`): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/actions/deleteShape.ts:11](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/deleteShape.ts#L11)

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

Defined in: [core/src/actions/deleteShape.ts:21](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/deleteShape.ts#L21)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
