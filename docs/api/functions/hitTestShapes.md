[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / hitTestShapes

# Function: hitTestShapes()

> **hitTestShapes**(`shapes`, `point`, `registry`): [`Shape`](../interfaces/Shape.md) \| `null`

Defined in: [core/src/model/hitTest.ts:24](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/hitTest.ts#L24)

Find the topmost shape at a point (back-to-front z-order)

## Parameters

### shapes

[`AnyShape`](../type-aliases/AnyShape.md)[]

### point

`Vec2`

### registry

[`ShapeHandlerRegistry`](../classes/ShapeHandlerRegistry.md)

## Returns

[`Shape`](../interfaces/Shape.md) \| `null`
