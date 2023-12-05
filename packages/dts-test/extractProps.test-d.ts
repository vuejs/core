import {
  ExtractDefaultPropTypes,
  ExtractPropTypes,
  ExtractPublicPropTypes
} from 'vue'
import { expectType, Prettify } from './utils'

const propsOptions = {
  foo: {
    default: 1
  },
  bar: {
    type: String,
    required: true
  },
  baz: Boolean,
  qux: Array
} as const

// internal facing props
declare const props: Prettify<ExtractPropTypes<typeof propsOptions>>

expectType<{
  foo: number
  bar: string
  baz: boolean
  qux: unknown[] | undefined
}>(props)

// external facing props
declare const publicProps: Prettify<ExtractPublicPropTypes<typeof propsOptions>>

expectType<{
  foo?: number | undefined
  bar: string
  baz?: boolean | undefined
  qux?: unknown[] | undefined
}>(publicProps)

// props with defaults
declare const propsWithDefaults: Prettify<
  ExtractDefaultPropTypes<typeof propsOptions>
>
expectType<{
  foo: number
  baz: boolean
}>(propsWithDefaults)
