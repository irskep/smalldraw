[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ToolRuntimeEvent

# Type Alias: ToolRuntimeEvent\<TPayload\>

> **ToolRuntimeEvent**\<`TPayload`\> = \{ `payload`: [`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]; `type`: `"handles"`; \} \| \{ `payload`: \{ `behavior`: [`HandleBehavior`](HandleBehavior.md) \| `null`; `handleId`: `string` \| `null`; \}; `type`: `"handle-hover"`; \} \| \{ `payload`: [`Bounds`](../interfaces/Bounds.md) \| `null`; `type`: `"selection-frame"`; \} \| \{ `payload`: `TPayload`; `type`: `"custom"`; \}

Defined in: [tools/types.ts:100](https://github.com/irskep/smalldraw/blob/d4a91538316dd6c96f0ce5dae0a231159f44b256/packages/core/src/tools/types.ts#L100)

## Type Parameters

### TPayload

`TPayload` = `unknown`
