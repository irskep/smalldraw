[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ResizeOperation

# Interface: ResizeOperation\<TGeometry, TData\>

Defined in: [model/shapeHandlers.ts:59](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L59)

Parameters for a resize operation

## Type Parameters

### TGeometry

`TGeometry` *extends* [`Geometry`](../type-aliases/Geometry.md) = [`Geometry`](../type-aliases/Geometry.md)

### TData

`TData` = `unknown`

## Properties

### initialBounds

> **initialBounds**: [`Bounds`](Bounds.md)

Defined in: [model/shapeHandlers.ts:64](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L64)

***

### layout?

> `optional` **layout**: [`NormalizedLayout`](NormalizedLayout.md)

Defined in: [model/shapeHandlers.ts:67](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L67)

***

### nextBounds

> **nextBounds**: [`Bounds`](Bounds.md)

Defined in: [model/shapeHandlers.ts:65](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L65)

***

### selectionScale

> **selectionScale**: `object`

Defined in: [model/shapeHandlers.ts:66](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L66)

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### shape

> **shape**: [`Shape`](Shape.md) & `object`

Defined in: [model/shapeHandlers.ts:60](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L60)

#### Type Declaration

##### geometry

> **geometry**: `TGeometry`

***

### snapshotData?

> `optional` **snapshotData**: `TData`

Defined in: [model/shapeHandlers.ts:62](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L62)

***

### snapshotGeometry

> **snapshotGeometry**: `TGeometry`

Defined in: [model/shapeHandlers.ts:61](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L61)

***

### transform

> **transform**: [`CanonicalShapeTransform`](CanonicalShapeTransform.md)

Defined in: [model/shapeHandlers.ts:63](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L63)
