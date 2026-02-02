[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DirtyState

# Interface: DirtyState

Defined in: [core/src/store/drawingStore.ts:37](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L37)

Result of consuming dirty state for incremental rendering.

## Properties

### deleted

> **deleted**: `Set`\<`string`\>

Defined in: [core/src/store/drawingStore.ts:41](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L41)

Shape IDs that were deleted and no longer exist.

***

### dirty

> **dirty**: `Set`\<`string`\>

Defined in: [core/src/store/drawingStore.ts:39](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L39)

Shape IDs that were modified and still exist.
