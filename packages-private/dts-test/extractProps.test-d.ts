import type { ExtractPropTypes, ExtractPublicPropTypes } from 'vue'
import { type Prettify, expectAssignable, expectType } from './utils'

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

expectAssignable<number>(props.foo)
expectType(props.bar, {} as string)
expectType(props.baz, {} as boolean)
expectType(props.qux, {} as unknown[] | undefined)

// external facing props
declare const publicProps: Prettify<ExtractPublicPropTypes<typeof propsOptions>>

expectAssignable<number | undefined>(publicProps.foo)
expectType(publicProps.bar, {} as string)
expectType(publicProps.baz, {} as boolean | undefined)
expectType(publicProps.qux, {} as unknown[] | undefined)
