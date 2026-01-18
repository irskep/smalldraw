[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ShapeOperations

# Interface: ShapeOperations\<T\>

Defined in: [model/shapeHandlers.ts:23](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L23)

Operations that need the full Shape (with transform/style)

## Type Parameters

### T

`T` *extends* [`Geometry`](../type-aliases/Geometry.md) = [`Geometry`](../type-aliases/Geometry.md)

## Properties

### hitTest()?

> `optional` **hitTest**: (`shape`, `point`) => `boolean`

Defined in: [model/shapeHandlers.ts:28](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L28)

Test if a world-space point is inside the shape.
Returns true if the point hits the shape (considering fill, stroke, transform).

#### Parameters

##### shape

[`Shape`](Shape.md) & `object`

##### point

[`Point`](Point.md)

#### Returns

`boolean`
