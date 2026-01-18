[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UndoManager

# Class: UndoManager

Defined in: [undo.ts:4](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/undo.ts#L4)

## Constructors

### Constructor

> **new UndoManager**(): `UndoManager`

#### Returns

`UndoManager`

## Methods

### apply()

> **apply**(`action`, `doc`, `ctx`): `void`

Defined in: [undo.ts:8](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/undo.ts#L8)

#### Parameters

##### action

[`UndoableAction`](../interfaces/UndoableAction.md)

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

`void`

***

### canRedo()

> **canRedo**(): `boolean`

Defined in: [undo.ts:38](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/undo.ts#L38)

#### Returns

`boolean`

***

### canUndo()

> **canUndo**(): `boolean`

Defined in: [undo.ts:34](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/undo.ts#L34)

#### Returns

`boolean`

***

### clear()

> **clear**(): `void`

Defined in: [undo.ts:42](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/undo.ts#L42)

#### Returns

`void`

***

### redo()

> **redo**(`doc`, `ctx`): [`UndoableAction`](../interfaces/UndoableAction.md) \| `null`

Defined in: [undo.ts:24](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/undo.ts#L24)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`UndoableAction`](../interfaces/UndoableAction.md) \| `null`

***

### undo()

> **undo**(`doc`, `ctx`): [`UndoableAction`](../interfaces/UndoableAction.md) \| `null`

Defined in: [undo.ts:14](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/undo.ts#L14)

#### Parameters

##### doc

[`DrawingDocument`](../interfaces/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`UndoableAction`](../interfaces/UndoableAction.md) \| `null`
