import { expectType } from './utils'

// @ts-expect-error literal and primitive types are not identical
expectType(1 as const, {} as number)

declare const anyValue: any
// @ts-expect-error `any` is not identical to `number`
expectType(anyValue, {} as number)

declare const readonlyValue: { readonly value: number }
// @ts-expect-error readonly and mutable properties are not identical
expectType(readonlyValue, {} as { value: number })
