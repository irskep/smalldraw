[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ShapeHandler

# Interface: ShapeHandler\<T, TResizeData\>

Defined in: [model/shapeHandlers.ts:90](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L90)

Complete handler for a shape type - all operations optional except getBounds

## Type Parameters

### T

`T` *extends* [`Geometry`](../type-aliases/Geometry.md) = [`Geometry`](../type-aliases/Geometry.md)

### TResizeData

`TResizeData` = `unknown`

## Properties

### geometry

> **geometry**: [`GeometryOperations`](GeometryOperations.md)\<`T`\>

Defined in: [model/shapeHandlers.ts:92](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L92)

Operations on geometry alone (REQUIRED)

***

### selection?

> `optional` **selection**: [`SelectionOperations`](SelectionOperations.md)\<`T`, `TResizeData`\>

Defined in: [model/shapeHandlers.ts:98](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L98)

Selection and resize operations (OPTIONAL)

***

### shape?

> `optional` **shape**: [`ShapeOperations`](ShapeOperations.md)\<`T`\>

Defined in: [model/shapeHandlers.ts:95](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L95)

Operations needing the full shape (OPTIONAL)
