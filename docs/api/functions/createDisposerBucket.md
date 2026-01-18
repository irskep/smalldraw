[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / createDisposerBucket

# Function: createDisposerBucket()

> **createDisposerBucket**(): [`DisposerBucket`](../interfaces/DisposerBucket.md)

Defined in: [tools/disposerBucket.ts:27](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/disposerBucket.ts#L27)

Create a new disposer bucket for managing cleanup callbacks.

## Returns

[`DisposerBucket`](../interfaces/DisposerBucket.md)

## Example

```ts
const disposers = createDisposerBucket();
disposers.add(() => console.log('cleanup 1'));
disposers.add(() => console.log('cleanup 2'));
disposers.dispose(); // logs both, then clears
```
