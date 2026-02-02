[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ShapeTransform

# Interface: ShapeTransform

Defined in: [core/src/model/shape.ts:25](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/shape.ts#L25)

## Properties

### origin?

> `optional` **origin**: `Vec2Tuple`

Defined in: [core/src/model/shape.ts:37](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/shape.ts#L37)

***

### rotation?

> `optional` **rotation**: `number`

Defined in: [core/src/model/shape.ts:32](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/shape.ts#L32)

***

### scale?

> `optional` **scale**: `Vec2Tuple`

Defined in: [core/src/model/shape.ts:33](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/shape.ts#L33)

***

### translation

> **translation**: `Vec2Tuple`

Defined in: [core/src/model/shape.ts:31](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/shape.ts#L31)

Translation stores the world-space center of the shape's geometry. Tools should not
mix coordinate origins (e.g. top-left) because selection/rotation math assumes this
pivot when computing bounds.
