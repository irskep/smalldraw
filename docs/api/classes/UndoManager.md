[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UndoManager

# Class: UndoManager

Defined in: [core/src/undo.ts:10](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/undo.ts#L10)

## Constructors

### Constructor

> **new UndoManager**(): `UndoManager`

#### Returns

`UndoManager`

## Methods

### apply()

> **apply**(`action`, `doc`, `ctx`): [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/undo.ts:37](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/undo.ts#L37)

#### Parameters

##### action

[`UndoableAction`](../interfaces/UndoableAction.md)

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

***

### canRedo()

> **canRedo**(): `boolean`

Defined in: [core/src/undo.ts:90](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/undo.ts#L90)

#### Returns

`boolean`

***

### canUndo()

> **canUndo**(): `boolean`

Defined in: [core/src/undo.ts:86](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/undo.ts#L86)

#### Returns

`boolean`

***

### clear()

> **clear**(): `void`

Defined in: [core/src/undo.ts:94](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/undo.ts#L94)

#### Returns

`void`

***

### record()

> **record**(`action`): `void`

Defined in: [core/src/undo.ts:14](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/undo.ts#L14)

#### Parameters

##### action

[`UndoableAction`](../interfaces/UndoableAction.md)

#### Returns

`void`

***

### redo()

> **redo**(`doc`, `ctx`): [`UndoOutcome`](../interfaces/UndoOutcome.md)

Defined in: [core/src/undo.ts:67](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/undo.ts#L67)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`UndoOutcome`](../interfaces/UndoOutcome.md)

***

### takeRedo()

> **takeRedo**(): [`UndoableAction`](../interfaces/UndoableAction.md) \| `null`

Defined in: [core/src/undo.ts:28](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/undo.ts#L28)

#### Returns

[`UndoableAction`](../interfaces/UndoableAction.md) \| `null`

***

### takeUndo()

> **takeUndo**(): [`UndoableAction`](../interfaces/UndoableAction.md) \| `null`

Defined in: [core/src/undo.ts:19](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/undo.ts#L19)

#### Returns

[`UndoableAction`](../interfaces/UndoableAction.md) \| `null`

***

### undo()

> **undo**(`doc`, `ctx`): [`UndoOutcome`](../interfaces/UndoOutcome.md)

Defined in: [core/src/undo.ts:48](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/undo.ts#L48)

#### Parameters

##### doc

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

##### ctx

[`ActionContext`](../interfaces/ActionContext.md)

#### Returns

[`UndoOutcome`](../interfaces/UndoOutcome.md)
