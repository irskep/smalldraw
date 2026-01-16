[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ToolRuntimeEvent

# Type Alias: ToolRuntimeEvent\<TPayload\>

> **ToolRuntimeEvent**\<`TPayload`\> = \{ `payload`: [`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]; `type`: `"handles"`; \} \| \{ `payload`: \{ `behavior`: [`HandleBehavior`](HandleBehavior.md) \| `null`; `handleId`: `string` \| `null`; \}; `type`: `"handle-hover"`; \} \| \{ `payload`: [`Bounds`](../interfaces/Bounds.md) \| `null`; `type`: `"selection-frame"`; \} \| \{ `payload`: `TPayload`; `type`: `"custom"`; \}

Defined in: [tools/types.ts:98](https://github.com/irskep/smalldraw/blob/23842d392e9e05da6a41ad6992d9fc742cdc6f30/packages/core/src/tools/types.ts#L98)

## Type Parameters

### TPayload

`TPayload` = `unknown`
