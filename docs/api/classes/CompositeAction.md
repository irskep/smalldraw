[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / CompositeAction

# Class: CompositeAction

Defined in: [actions/composite.ts:4](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/composite.ts#L4)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new CompositeAction**(`actions`): `CompositeAction`

Defined in: [actions/composite.ts:5](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/composite.ts#L5)

#### Parameters

##### actions

[`UndoableAction`](../interfaces/UndoableAction.md)[]

#### Returns

`CompositeAction`

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [actions/composite.ts:19](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/composite.ts#L19)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectedShapeIds`](../interfaces/UndoableAction.md#affectedshapeids)

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [actions/composite.ts:29](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/composite.ts#L29)

#### Returns

`boolean`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`affectsZOrder`](../interfaces/UndoableAction.md#affectszorder)

***

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/composite.ts:7](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/composite.ts#L7)

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

Defined in: [actions/composite.ts:13](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/actions/composite.ts#L13)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
