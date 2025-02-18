import type { ExtractPropTypes, ExtractPublicPropTypes } from 'vue'
import { type Prettify, expectType } from './utils'

const propsOptions = {
  foo: {
    default: 1,
  },
  bar: {
    type: String,
    required: true,
  },
  baz: Boolean,
  qux: Array,
} as const

// internal facing props
declare const props: Prettify<ExtractPropTypes<typeof propsOptions>>

expectType<number>(props.foo)
expectType<string>(props.bar)
expectType<boolean>(props.baz)
expectType<unknown[] | undefined>(props.qux)

// external facing props
declare const publicProps: Prettify<ExtractPublicPropTypes<typeof propsOptions>>

expectType<number | undefined>(publicProps.foo)
expectType<string>(publicProps.bar)
expectType<boolean | undefined>(publicProps.baz)
expectType<unknown[] | undefined>(publicProps.qux)
