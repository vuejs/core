import { genericProps } from 'dts-built-test'
import { CustomPropsNotErased } from 'dts-built-test/src/index'
import { type DefineProps, toRefs } from 'vue'
import { type IsAny, describe, expectType } from './utils'

declare module 'vue' {
  interface ComponentCustomProps {
    custom?: number
  }
}

// #8376 - custom props should not be erased
describe('Custom Props not erased', () => {
  expectType<number | undefined>(new CustomPropsNotErased().$props.custom)
})

describe('generic props retain array types after declaration emit', <T>() => {
  const { options } = toRefs(genericProps<T>())
  expectType<false>(null! as IsAny<typeof options.value>)
  options.value.find(item => {
    expectType<false>(null! as IsAny<typeof item>)
    expectType<T>(item.value)
    return true
  })
})

describe('generic props retain Boolean keys after declaration emit', () => {
  type ExtractBooleanKeys<T> =
    T extends DefineProps<T, infer K extends keyof T> ? K : never
  type Keys = ExtractBooleanKeys<ReturnType<typeof genericProps<string>>>

  expectType<false>(null! as IsAny<Keys>)
  expectType<Keys>('active')
  expectType<'active'>(null! as Keys)
})
