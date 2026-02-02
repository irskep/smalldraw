[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DrawingStoreAdapter

# Interface: DrawingStoreAdapter

Defined in: [core/src/store/drawingStore.ts:52](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L52)

## Properties

### applyAction()

> **applyAction**: (`event`) => `void`

Defined in: [core/src/store/drawingStore.ts:54](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L54)

#### Parameters

##### event

[`DrawingStoreActionEvent`](DrawingStoreActionEvent.md)

#### Returns

`void`

***

### getDoc()

> **getDoc**: () => [`DrawingDocument`](../type-aliases/DrawingDocument.md)

Defined in: [core/src/store/drawingStore.ts:53](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L53)

#### Returns

[`DrawingDocument`](../type-aliases/DrawingDocument.md)

***

### subscribe()

> **subscribe**: (`listener`) => () => `void`

Defined in: [core/src/store/drawingStore.ts:55](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/store/drawingStore.ts#L55)

#### Parameters

##### listener

(`doc`) => `void`

#### Returns

> (): `void`

##### Returns

`void`
