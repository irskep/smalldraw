[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / CustomGeometry

# Interface: CustomGeometry

Defined in: [model/geometry.ts:72](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/geometry.ts#L72)

Base interface for custom geometry types. To create a custom geometry,
define an interface that extends Geometry with a specific type literal:

## Example

```typescript
interface StarGeometry extends Geometry {
  type: 'star';
  radius: number;
  points: number;
}
```

## Properties

### type

> **type**: `string`

Defined in: [model/geometry.ts:73](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/model/geometry.ts#L73)
