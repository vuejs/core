import {
  type InjectionKey,
  type Ref,
  createApp,
  inject,
  provide,
  ref,
} from 'vue'
import { expectType } from './utils'

// non-symbol keys
provide('foo', 123)
provide(123, 123)

const key: InjectionKey<number> = Symbol()

provide(key, 1)
// @ts-expect-error
provide(key, 'foo')
// @ts-expect-error
provide(key, null)

expectType<number | undefined>(inject(key))
expectType<number>(inject(key, 1))
expectType<number>(inject(key, () => 1, true /* treatDefaultAsFactory */))

expectType<() => number>(inject('foo', () => 1))
expectType<() => number>(inject('foo', () => 1, false))
expectType<number>(inject('foo', () => 1, true))

// #8201
type Cube = {
  size: number
}

const injectionKeyRef = Symbol('key') as InjectionKey<Ref<Cube>>

// @ts-expect-error
provide(injectionKeyRef, ref({}))

// naive-ui: explicit provide type parameter
provide<Cube>('cube', { size: 123 })
provide<Cube>(123, { size: 123 })
provide<Cube>(injectionKeyRef, { size: 123 })

// @ts-expect-error
provide<Cube>('cube', { size: 'foo' })
// @ts-expect-error
provide<Cube>(123, { size: 'foo' })

// #10602
const app = createApp({})
// @ts-expect-error
app.provide(injectionKeyRef, ref({}))
