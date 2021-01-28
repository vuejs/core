import { provide, inject, InjectionKey, expectType } from './index'

const key: InjectionKey<number> = Symbol()

provide(key, 1)
// @ts-expect-error
provide(key, 'foo')

expectType<number | undefined>(inject(key))
expectType<number>(inject(key, 1))
expectType<number>(inject(key, () => 1, true /* treatDefaultAsFactory */))

expectType<() => number>(inject('foo', () => 1))
expectType<() => number>(inject('foo', () => 1, false))
expectType<number>(inject('foo', () => 1, true))

// InjectionKey should be compatible with the `symbol` type
expectType<Record<symbol, number>>({ [key]: 2 })
