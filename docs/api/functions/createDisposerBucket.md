[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / createDisposerBucket

# Function: createDisposerBucket()

> **createDisposerBucket**(): [`DisposerBucket`](../interfaces/DisposerBucket.md)

Defined in: [core/src/tools/disposerBucket.ts:27](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/disposerBucket.ts#L27)

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
