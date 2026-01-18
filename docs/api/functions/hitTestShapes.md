[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / hitTestShapes

# Function: hitTestShapes()

> **hitTestShapes**(`shapes`, `point`, `registry`): [`Shape`](../interfaces/Shape.md) \| `null`

Defined in: [model/hitTest.ts:35](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/hitTest.ts#L35)

Find the topmost shape at a point (back-to-front z-order)

## Parameters

### shapes

[`Shape`](../interfaces/Shape.md)[]

### point

[`Point`](../interfaces/Point.md)

### registry

[`ShapeHandlerRegistry`](../classes/ShapeHandlerRegistry.md)

## Returns

[`Shape`](../interfaces/Shape.md) \| `null`
