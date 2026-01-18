[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ToolRuntimeEvent

# Type Alias: ToolRuntimeEvent\<TPayload\>

> **ToolRuntimeEvent**\<`TPayload`\> = \{ `payload`: [`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]; `type`: `"handles"`; \} \| \{ `payload`: \{ `behavior`: [`HandleBehavior`](HandleBehavior.md) \| `null`; `handleId`: `string` \| `null`; \}; `type`: `"handle-hover"`; \} \| \{ `payload`: [`Bounds`](../interfaces/Bounds.md) \| `null`; `type`: `"selection-frame"`; \} \| \{ `payload`: `TPayload`; `type`: `"custom"`; \}

Defined in: [tools/types.ts:98](https://github.com/irskep/smalldraw/blob/96a50fa2ec78e697fccacd3ef6b146f637d38bd0/packages/core/src/tools/types.ts#L98)

## Type Parameters

### TPayload

`TPayload` = `unknown`
