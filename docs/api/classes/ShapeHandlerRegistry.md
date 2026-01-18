[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ShapeHandlerRegistry

# Class: ShapeHandlerRegistry

Defined in: [model/shapeHandlers.ts:101](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L101)

## Constructors

### Constructor

> **new ShapeHandlerRegistry**(): `ShapeHandlerRegistry`

#### Returns

`ShapeHandlerRegistry`

## Methods

### clone()

> **clone**(): `ShapeHandlerRegistry`

Defined in: [model/shapeHandlers.ts:131](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L131)

#### Returns

`ShapeHandlerRegistry`

***

### get()

> **get**(`type`): [`ShapeHandler`](../interfaces/ShapeHandler.md)\<[`Geometry`](../type-aliases/Geometry.md), `unknown`\> \| `undefined`

Defined in: [model/shapeHandlers.ts:108](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L108)

#### Parameters

##### type

`string`

#### Returns

[`ShapeHandler`](../interfaces/ShapeHandler.md)\<[`Geometry`](../type-aliases/Geometry.md), `unknown`\> \| `undefined`

***

### getGeometryOps()

> **getGeometryOps**(`type`): [`GeometryOperations`](../interfaces/GeometryOperations.md)\<[`Geometry`](../type-aliases/Geometry.md)\> \| `undefined`

Defined in: [model/shapeHandlers.ts:117](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L117)

Convenience: get geometry operations

#### Parameters

##### type

`string`

#### Returns

[`GeometryOperations`](../interfaces/GeometryOperations.md)\<[`Geometry`](../type-aliases/Geometry.md)\> \| `undefined`

***

### getSelectionOps()

> **getSelectionOps**(`type`): [`SelectionOperations`](../interfaces/SelectionOperations.md)\<[`Geometry`](../type-aliases/Geometry.md), `unknown`\> \| `undefined`

Defined in: [model/shapeHandlers.ts:127](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L127)

Convenience: get selection operations

#### Parameters

##### type

`string`

#### Returns

[`SelectionOperations`](../interfaces/SelectionOperations.md)\<[`Geometry`](../type-aliases/Geometry.md), `unknown`\> \| `undefined`

***

### getShapeOps()

> **getShapeOps**(`type`): [`ShapeOperations`](../interfaces/ShapeOperations.md)\<[`Geometry`](../type-aliases/Geometry.md)\> \| `undefined`

Defined in: [model/shapeHandlers.ts:122](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L122)

Convenience: get shape operations

#### Parameters

##### type

`string`

#### Returns

[`ShapeOperations`](../interfaces/ShapeOperations.md)\<[`Geometry`](../type-aliases/Geometry.md)\> \| `undefined`

***

### has()

> **has**(`type`): `boolean`

Defined in: [model/shapeHandlers.ts:112](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L112)

#### Parameters

##### type

`string`

#### Returns

`boolean`

***

### register()

> **register**\<`T`\>(`type`, `handler`): `void`

Defined in: [model/shapeHandlers.ts:104](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/shapeHandlers.ts#L104)

#### Type Parameters

##### T

`T` *extends* [`Geometry`](../type-aliases/Geometry.md)

#### Parameters

##### type

`string`

##### handler

[`ShapeHandler`](../interfaces/ShapeHandler.md)\<`T`\>

#### Returns

`void`
