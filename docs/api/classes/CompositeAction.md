[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / CompositeAction

# Class: CompositeAction

Defined in: [core/src/actions/composite.ts:4](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/composite.ts#L4)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new CompositeAction**(`actions`): `CompositeAction`

Defined in: [core/src/actions/composite.ts:5](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/composite.ts#L5)

#### Parameters

##### actions

[`UndoableAction`](../interfaces/UndoableAction.md)[]

#### Returns

`CompositeAction`

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [core/src/actions/composite.ts:23](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/composite.ts#L23)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectedShapeIds`](../interfaces/UndoableAction.md#affectedshapeids)

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [core/src/actions/composite.ts:33](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/composite.ts#L33)

#### Returns

`boolean`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectsZOrder`](../interfaces/UndoableAction.md#affectszorder)

***

### redo()

> **redo**(`doc`, `ctx`): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/actions/composite.ts:7](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/composite.ts#L7)

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

Defined in: [core/src/actions/composite.ts:15](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/actions/composite.ts#L15)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
