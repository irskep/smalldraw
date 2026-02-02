[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ShapeHandlerRegistry

# Class: ShapeHandlerRegistry

Defined in: [core/src/model/shapeHandlers.ts:6](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/shapeHandlers.ts#L6)

## Constructors

### Constructor

> **new ShapeHandlerRegistry**(): `ShapeHandlerRegistry`

#### Returns

`ShapeHandlerRegistry`

## Methods

### clone()

> **clone**(): `ShapeHandlerRegistry`

Defined in: [core/src/model/shapeHandlers.ts:26](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/shapeHandlers.ts#L26)

#### Returns

`ShapeHandlerRegistry`

***

### get()

> **get**\<`T`, `TResizeData`\>(`type`): `ShapeHandler`\<`T`, `TResizeData`\> \| `undefined`

Defined in: [core/src/model/shapeHandlers.ts:16](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/shapeHandlers.ts#L16)

#### Type Parameters

##### T

`T` *extends* [`AnyGeometry`](../interfaces/AnyGeometry.md)

##### TResizeData

`TResizeData`

#### Parameters

##### type

`string`

#### Returns

`ShapeHandler`\<`T`, `TResizeData`\> \| `undefined`

***

### has()

> **has**(`type`): `boolean`

Defined in: [core/src/model/shapeHandlers.ts:22](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/shapeHandlers.ts#L22)

#### Parameters

##### type

`string`

#### Returns

`boolean`

***

### register()

> **register**\<`T`, `TResizeData`\>(`type`, `handler`): `void`

Defined in: [core/src/model/shapeHandlers.ts:9](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/model/shapeHandlers.ts#L9)

#### Type Parameters

##### T

`T` *extends* [`AnyGeometry`](../interfaces/AnyGeometry.md)

##### TResizeData

`TResizeData`

#### Parameters

##### type

`string`

##### handler

`ShapeHandler`\<`T`, `TResizeData`\>

#### Returns

`void`
