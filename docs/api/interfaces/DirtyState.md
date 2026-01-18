[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DirtyState

# Interface: DirtyState

Defined in: [store/drawingStore.ts:32](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L32)

Result of consuming dirty state for incremental rendering.

## Properties

### deleted

> **deleted**: `Set`\<`string`\>

Defined in: [store/drawingStore.ts:36](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L36)

Shape IDs that were deleted and no longer exist.

***

### dirty

> **dirty**: `Set`\<`string`\>

Defined in: [store/drawingStore.ts:34](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/store/drawingStore.ts#L34)

Shape IDs that were modified and still exist.
