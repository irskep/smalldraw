[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ShapeTransform

# Interface: ShapeTransform

Defined in: [model/shape.ts:18](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/model/shape.ts#L18)

## Properties

### origin?

> `optional` **origin**: `object`

Defined in: [model/shape.ts:27](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/model/shape.ts#L27)

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### rotation?

> `optional` **rotation**: `number`

Defined in: [model/shape.ts:25](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/model/shape.ts#L25)

***

### scale?

> `optional` **scale**: `object`

Defined in: [model/shape.ts:26](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/model/shape.ts#L26)

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### translation

> **translation**: `object`

Defined in: [model/shape.ts:24](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/model/shape.ts#L24)

Translation stores the world-space center of the shape's geometry. Tools should not
mix coordinate origins (e.g. top-left) because selection/rotation math assumes this
pivot when computing bounds.

#### x

> **x**: `number`

#### y

> **y**: `number`
