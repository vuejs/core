import {
  type InjectionKey,
  type Ref,
  createApp,
  defineComponent,
  inject,
  provide,
  ref,
} from 'vue'
import { expectAssignable, expectType } from './utils'

// non-symbol keys
provide('foo', 123)
provide(123, 123)

const key: InjectionKey<number> = Symbol()

provide(key, 1)
// @ts-expect-error
provide(key, 'foo')
// @ts-expect-error
provide(key, null)

expectType(inject(key), {} as number | undefined)
expectType(inject(key, 1), {} as number)
expectType(
  inject(key, () => 1, true /* treatDefaultAsFactory */),
  {} as number,
)

expectAssignable<() => number>(inject('foo', () => 1))
expectAssignable<() => number>(inject('foo', () => 1, false))
expectType(
  inject('foo', () => 1, true),
  {} as number,
)

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

defineComponent({
  provide: {
    [injectionKeyRef]: { size: 'foo' },
  },
})
