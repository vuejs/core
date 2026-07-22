import {
  type Ref,
  markRaw,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowReadonly,
} from 'vue'
import { describe, expectAssignable, expectType } from './utils'

describe('should support DeepReadonly', () => {
  const r = readonly({ obj: { k: 'v' } })
  // @ts-expect-error
  r.obj = {}
  // @ts-expect-error
  r.obj.k = 'x'
})

// #4180
describe('readonly ref', () => {
  const r = readonly(ref({ count: 1 }))
  expectAssignable<Ref>(r)
})

describe('should support markRaw', () => {
  class Test<T> {
    item = {} as Ref<T>
  }
  const test = new Test<number>()
  const plain = {
    ref: ref(1),
  }

  const r = reactive({
    class: {
      raw: markRaw(test),
      reactive: test,
    },
    plain: {
      raw: markRaw(plain),
      reactive: plain,
    },
  })

  expectAssignable<Test<number>>(r.class.raw)
  expectType(r.class.reactive.item, {} as number)

  expectType(r.plain.raw.ref, {} as Ref<number>)
  expectType(r.plain.reactive.ref, {} as number)
})

describe('shallowReadonly ref unwrap', () => {
  const r = shallowReadonly({ count: { n: ref(1) } })
  // @ts-expect-error
  r.count = 2
  expectType(r.count.n, {} as Ref<number>)
  r.count.n.value = 123
})

// #3819
describe('should unwrap tuple correctly', () => {
  const readonlyTuple = [ref(0)] as const
  const reactiveReadonlyTuple = reactive(readonlyTuple)
  expectType(reactiveReadonlyTuple[0], {} as Ref<number>)

  const tuple: [Ref<number>] = [ref(0)]
  const reactiveTuple = reactive(tuple)
  expectType(reactiveTuple[0], {} as Ref<number>)
})

describe('should unwrap Map correctly', () => {
  const map = reactive(new Map<string, Ref<number>>())
  expectType(map.get('a')!, {} as Ref<number>)

  const map2 = reactive(new Map<string, { wrap: Ref<number> }>())
  expectType(map2.get('a')!.wrap, {} as number)

  const wm = reactive(new WeakMap<object, Ref<number>>())
  expectType(wm.get({})!, {} as Ref<number>)

  const wm2 = reactive(new WeakMap<object, { wrap: Ref<number> }>())
  expectType(wm2.get({})!.wrap, {} as number)
})

describe('should unwrap extended Map correctly', () => {
  class ExtendendMap1 extends Map<string, { wrap: Ref<number> }> {
    foo = ref('foo')
    bar = 1
  }

  const emap1 = reactive(new ExtendendMap1())
  expectType(emap1.foo, {} as string)
  expectType(emap1.bar, {} as number)
  expectType(emap1.get('a')!.wrap, {} as number)
})

describe('should unwrap Set correctly', () => {
  const set = reactive(new Set<Ref<number>>())
  expectAssignable<Set<Ref<number>>>(set)

  const set2 = reactive(new Set<{ wrap: Ref<number> }>())
  expectAssignable<Set<{ wrap: number }>>(set2)

  const ws = reactive(new WeakSet<Ref<number>>())
  expectAssignable<WeakSet<Ref<number>>>(ws)

  const ws2 = reactive(new WeakSet<{ wrap: Ref<number> }>())
  expectAssignable<WeakSet<{ wrap: number }>>(ws2)
})

describe('should unwrap extended Set correctly', () => {
  class ExtendendSet1 extends Set<{ wrap: Ref<number> }> {
    foo = ref('foo')
    bar = 1
  }

  const eset1 = reactive(new ExtendendSet1())
  expectType(eset1.foo, {} as string)
  expectType(eset1.bar, {} as number)
})

describe('should not error when assignment', () => {
  const arr = reactive([''])
  let record: Record<number, string>
  record = arr
  expectType(record[0], {} as string)
  let record2: { [key: number]: string }
  record2 = arr
  expectType(record2[0], {} as string)
})

describe('shallowReactive marker should not leak into value unions', () => {
  const state = shallowReactive({
    a: { title: 'A' },
    b: { title: 'B' },
  })
  const value = {} as (typeof state)[keyof typeof state]
  expectType(value.title, {} as string)
})

describe('shallowReactive type should accept plain object assignment', () => {
  const shallow = shallowReactive({ a: 1, b: 2 })
  let values: typeof shallow
  values = { a: 1, b: 2 }
})
