[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DirtyState

# Interface: DirtyState

Defined in: [store/drawingStore.ts:26](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L26)

Result of consuming dirty state for incremental rendering.

## Properties

### deleted

> **deleted**: `Set`\<`string`\>

Defined in: [store/drawingStore.ts:30](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L30)

Shape IDs that were deleted and no longer exist.

***

### dirty

> **dirty**: `Set`\<`string`\>

Defined in: [store/drawingStore.ts:28](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/store/drawingStore.ts#L28)

Shape IDs that were modified and still exist.
