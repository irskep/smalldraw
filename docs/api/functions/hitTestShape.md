[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / hitTestShape

# Function: hitTestShape()

> **hitTestShape**(`shape`, `point`, `registry`): `boolean`

Defined in: [model/hitTest.ts:10](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/hitTest.ts#L10)

Test if a world-space point hits a shape
Falls back to AABB test if no specific hit test is provided

## Parameters

### shape

[`Shape`](../interfaces/Shape.md)

### point

[`Point`](../interfaces/Point.md)

### registry

[`ShapeHandlerRegistry`](../classes/ShapeHandlerRegistry.md)

## Returns

`boolean`
