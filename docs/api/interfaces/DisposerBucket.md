[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / DisposerBucket

# Interface: DisposerBucket

Defined in: [tools/disposerBucket.ts:5](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/disposerBucket.ts#L5)

A helper for managing collections of cleanup/disposer functions.
Eliminates boilerplate around collecting and calling teardown callbacks.

## Methods

### add()

> **add**(`disposer`): `void`

Defined in: [tools/disposerBucket.ts:9](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/disposerBucket.ts#L9)

Add a cleanup function to be called when dispose() is invoked.

#### Parameters

##### disposer

() => `void`

#### Returns

`void`

***

### dispose()

> **dispose**(): `void`

Defined in: [tools/disposerBucket.ts:15](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/disposerBucket.ts#L15)

Call all cleanup functions and clear the collection.
Safe to call multiple times.

#### Returns

`void`
