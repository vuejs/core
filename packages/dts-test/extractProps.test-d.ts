import {
  ExtractDefaultPropTypes,
  ExtractPropTypes,
  ExtractPublicPropTypes
} from 'vue'
import { expectType, OptionalKeys, Prettify } from './utils'

const propsOptions = {
  foo: {
    default: 1
  },
  bar: {
    type: String,
    required: true
  },
  baz: Boolean,
  boolAndUndefined: {
    type: Boolean,
    default: undefined
  },
  qux: Array
} as const

// internal facing props
declare const props: Prettify<ExtractPropTypes<typeof propsOptions>>

expectType<{
  foo: number
  bar: string
  baz: boolean
  boolAndUndefined: boolean | undefined
  qux: unknown[] | undefined
}>(props)
// no optional keys
expectType<never>('' as OptionalKeys<typeof props>)

// external facing props
declare const publicProps: Prettify<ExtractPublicPropTypes<typeof propsOptions>>

expectType<{
  foo?: number | undefined
  bar: string
  baz?: boolean | undefined
  boolAndUndefined?: boolean | undefined
  qux?: unknown[] | undefined
}>(publicProps)
expectType<'foo' | 'baz' | 'boolAndUndefined' | 'qux'>(
  '' as OptionalKeys<typeof props>
)

// props with defaults
declare const propsWithDefaults: Prettify<
  ExtractDefaultPropTypes<typeof propsOptions>
>
expectType<{
  foo: 1
  baz: boolean
  boolAndUndefined: boolean
}>(propsWithDefaults)
