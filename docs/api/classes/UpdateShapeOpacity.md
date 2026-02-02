[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UpdateShapeOpacity

# Class: UpdateShapeOpacity

Defined in: [core/src/actions/updateOpacity.ts:5](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateOpacity.ts#L5)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new UpdateShapeOpacity**(`shapeId`, `nextOpacity`): `UpdateShapeOpacity`

Defined in: [core/src/actions/updateOpacity.ts:9](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateOpacity.ts#L9)

#### Parameters

##### shapeId

`string`

##### nextOpacity

`number` | `undefined`

#### Returns

`UpdateShapeOpacity`

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [core/src/actions/updateOpacity.ts:55](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateOpacity.ts#L55)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectedShapeIds`](../interfaces/UndoableAction.md#affectedshapeids)

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [core/src/actions/updateOpacity.ts:59](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateOpacity.ts#L59)

#### Returns

`boolean`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectsZOrder`](../interfaces/UndoableAction.md#affectszorder)

***

### redo()

> **redo**(`doc`, `ctx`): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/actions/updateOpacity.ts:14](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateOpacity.ts#L14)

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

Defined in: [core/src/actions/updateOpacity.ts:35](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/updateOpacity.ts#L35)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
