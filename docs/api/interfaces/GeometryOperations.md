[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / GeometryOperations

# Interface: GeometryOperations\<T\>

Defined in: [model/shapeHandlers.ts:9](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L9)

Operations that work on Geometry alone (no transform/style needed)

## Type Parameters

### T

`T` *extends* [`Geometry`](../type-aliases/Geometry.md) = [`Geometry`](../type-aliases/Geometry.md)

## Properties

### canonicalize()?

> `optional` **canonicalize**: (`geometry`, `center`) => `T`

Defined in: [model/shapeHandlers.ts:14](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L14)

Canonicalize geometry (convert world coords to local)

#### Parameters

##### geometry

`T`

##### center

[`Point`](Point.md)

#### Returns

`T`

***

### getBounds()

> **getBounds**: (`geometry`) => [`Bounds`](Bounds.md) \| `null`

Defined in: [model/shapeHandlers.ts:11](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L11)

Compute local bounds for this geometry

#### Parameters

##### geometry

`T`

#### Returns

[`Bounds`](Bounds.md) \| `null`

***

### validate()?

> `optional` **validate**: (`geometry`) => `boolean`

Defined in: [model/shapeHandlers.ts:17](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L17)

Validate geometry data

#### Parameters

##### geometry

`T`

#### Returns

`boolean`
