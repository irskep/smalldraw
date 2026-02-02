[**@smalldraw/core**](../README.md)

***

[@smalldraw/core](../globals.md) / ToolRuntimeEvent

# Type Alias: ToolRuntimeEvent\<TPayload\>

> **ToolRuntimeEvent**\<`TPayload`\> = \{ `payload`: [`HandleDescriptor`](../interfaces/HandleDescriptor.md)[]; `type`: `"handles"`; \} \| \{ `payload`: \{ `behavior`: [`HandleBehavior`](HandleBehavior.md) \| `null`; `handleId`: `string` \| `null`; \}; `type`: `"handle-hover"`; \} \| \{ `payload`: `Box` \| `null`; `type`: `"selection-frame"`; \} \| \{ `payload`: `TPayload`; `type`: `"custom"`; \}

Defined in: [core/src/tools/types.ts:99](https://github.com/irskep/smalldraw/blob/6027fb7e88386372b184bb46a9927de463b21725/packages/core/src/tools/types.ts#L99)

## Type Parameters

### TPayload

`TPayload` = `unknown`
