[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / UndoableAction

# Interface: UndoableAction

Defined in: [actions/types.ts:8](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/types.ts#L8)

## Methods

### affectedShapeIds()

> **affectedShapeIds**(): `string`[]

Defined in: [actions/types.ts:12](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/types.ts#L12)

Returns IDs of shapes affected by this action for dirty tracking.

#### Returns

`string`[]

***

### affectsZOrder()

> **affectsZOrder**(): `boolean`

Defined in: [actions/types.ts:13](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/types.ts#L13)

#### Returns

`boolean`

***

### redo()

> **redo**(`doc`, `ctx`): `void`

Defined in: [actions/types.ts:9](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/types.ts#L9)

#### Parameters

##### doc

[`DrawingDocument`](DrawingDocument.md)

##### ctx

[`ActionContext`](ActionContext.md)

#### Returns

`void`

***

### undo()

> **undo**(`doc`, `ctx`): `void`

Defined in: [actions/types.ts:10](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/actions/types.ts#L10)

#### Parameters

##### doc

[`DrawingDocument`](DrawingDocument.md)

##### ctx

[`ActionContext`](ActionContext.md)

#### Returns

`void`
