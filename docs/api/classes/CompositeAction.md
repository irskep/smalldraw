[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / CompositeAction

# Class: CompositeAction

Defined in: [actions/composite.ts:4](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/composite.ts#L4)

## Implements

- [`UndoableAction`](../interfaces/UndoableAction.md)

## Constructors

### Constructor

> **new CompositeAction**(`actions`): `CompositeAction`

Defined in: [actions/composite.ts:5](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/composite.ts#L5)

#### Parameters

##### actions

[`UndoableAction`](../interfaces/UndoableAction.md)[]

#### Returns

`CompositeAction`

## Methods

### redo()

> **redo**(`doc`): `void`

Defined in: [actions/composite.ts:7](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/composite.ts#L7)

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

Defined in: [actions/composite.ts:13](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/actions/composite.ts#L13)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

#### Returns

`void`

#### Implementation of

[`UndoableAction`](../interfaces/UndoableAction.md).[`undo`](../interfaces/UndoableAction.md#undo)
