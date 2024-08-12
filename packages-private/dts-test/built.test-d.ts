import { CustomPropsNotErased } from 'dts-built-test/src/index'
import { describe, expectType } from './utils'

declare module 'vue' {
  interface ComponentCustomProps {
    custom?: number
  }
}

// #8376 - custom props should not be erased
describe('Custom Props not erased', () => {
  expectType<number | undefined>(new CustomPropsNotErased().$props.custom)
})
