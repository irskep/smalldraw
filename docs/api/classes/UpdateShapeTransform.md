[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UpdateShapeTransform

# Class: UpdateShapeTransform

Defined in: [core/src/actions/updateTransform.ts:6](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateTransform.ts#L6)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new UpdateShapeTransform**(`shapeId`, `nextTransform`): `UpdateShapeTransform`

Defined in: [core/src/actions/updateTransform.ts:10](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateTransform.ts#L10)

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

Defined in: [core/src/actions/updateTransform.ts:57](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateTransform.ts#L57)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectedShapeIds`](../interfaces/UndoableAction.md#affectedshapeids)

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [core/src/actions/updateTransform.ts:61](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateTransform.ts#L61)

#### Returns

`boolean`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectsZOrder`](../interfaces/UndoableAction.md#affectszorder)

***

### redo()

> **redo**(`doc`, `ctx`): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/actions/updateTransform.ts:15](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateTransform.ts#L15)

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

Defined in: [core/src/actions/updateTransform.ts:36](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateTransform.ts#L36)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
