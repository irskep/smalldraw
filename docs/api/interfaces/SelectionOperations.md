[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / SelectionOperations

# Interface: SelectionOperations\<T, TData\>

Defined in: [model/shapeHandlers.ts:73](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L73)

Selection and resize operations

## Type Parameters

### T

`T` *extends* [`Geometry`](../type-aliases/Geometry.md) = [`Geometry`](../type-aliases/Geometry.md)

### TData

`TData` = `unknown`

## Properties

### canResize()?

> `optional` **canResize**: (`shape`) => `boolean`

Defined in: [model/shapeHandlers.ts:75](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L75)

Check if this shape can be resized

#### Parameters

##### shape

[`Shape`](Shape.md) & `object`

#### Returns

`boolean`

***

### prepareResize()?

> `optional` **prepareResize**: (`shape`) => [`ResizeSnapshot`](ResizeSnapshot.md)\<`T`, `TData`\>

Defined in: [model/shapeHandlers.ts:78](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L78)

Prepare a snapshot before resize begins

#### Parameters

##### shape

[`Shape`](Shape.md) & `object`

#### Returns

[`ResizeSnapshot`](ResizeSnapshot.md)\<`T`, `TData`\>

***

### resize()?

> `optional` **resize**: (`operation`) => [`ResizeResult`](ResizeResult.md) \| `null`

Defined in: [model/shapeHandlers.ts:81](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L81)

Perform a resize operation

#### Parameters

##### operation

[`ResizeOperation`](ResizeOperation.md)\<`T`, `TData`\>

#### Returns

[`ResizeResult`](ResizeResult.md) \| `null`

***

### supportsAxisResize()?

> `optional` **supportsAxisResize**: (`shape`) => `boolean`

Defined in: [model/shapeHandlers.ts:84](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L84)

Check if this shape supports axis-aligned resize (mid-handles)

#### Parameters

##### shape

[`Shape`](Shape.md) & `object`

#### Returns

`boolean`
