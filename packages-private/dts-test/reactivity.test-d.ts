import {
  type Ref,
  markRaw,
  reactive,
  readonly,
  ref,
  shallowReadonly,
} from 'vue'
import { describe, expectType } from './utils'

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
  expectType<Ref>(r)
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

  expectType<Test<number>>(r.class.raw)
  // @ts-expect-error it should unwrap
  expectType<Test<number>>(r.class.reactive)

  expectType<Ref<number>>(r.plain.raw.ref)
  // @ts-expect-error it should unwrap
  expectType<Ref<number>>(r.plain.reactive.ref)
})

describe('shallowReadonly ref unwrap', () => {
  const r = shallowReadonly({ count: { n: ref(1) } })
  // @ts-expect-error
  r.count = 2
  expectType<Ref>(r.count.n)
  r.count.n.value = 123
})

// #3819
describe('should unwrap tuple correctly', () => {
  const readonlyTuple = [ref(0)] as const
  const reactiveReadonlyTuple = reactive(readonlyTuple)
  expectType<Ref<number>>(reactiveReadonlyTuple[0])

  const tuple: [Ref<number>] = [ref(0)]
  const reactiveTuple = reactive(tuple)
  expectType<Ref<number>>(reactiveTuple[0])
})

describe('should unwrap Map correctly', () => {
  const map = reactive(new Map<string, Ref<number>>())
  expectType<Ref<number>>(map.get('a')!)

  const map2 = reactive(new Map<string, { wrap: Ref<number> }>())
  expectType<number>(map2.get('a')!.wrap)

  const wm = reactive(new WeakMap<object, Ref<number>>())
  expectType<Ref<number>>(wm.get({})!)

  const wm2 = reactive(new WeakMap<object, { wrap: Ref<number> }>())
  expectType<number>(wm2.get({})!.wrap)
})

describe('should unwrap extended Map correctly', () => {
  class ExtendendMap1 extends Map<string, { wrap: Ref<number> }> {
    foo = ref('foo')
    bar = 1
  }

  const emap1 = reactive(new ExtendendMap1())
  expectType<string>(emap1.foo)
  expectType<number>(emap1.bar)
  expectType<number>(emap1.get('a')!.wrap)
})

describe('should unwrap Set correctly', () => {
  const set = reactive(new Set<Ref<number>>())
  expectType<Set<Ref<number>>>(set)

  const set2 = reactive(new Set<{ wrap: Ref<number> }>())
  expectType<Set<{ wrap: number }>>(set2)

  const ws = reactive(new WeakSet<Ref<number>>())
  expectType<WeakSet<Ref<number>>>(ws)

  const ws2 = reactive(new WeakSet<{ wrap: Ref<number> }>())
  expectType<WeakSet<{ wrap: number }>>(ws2)
})

describe('should unwrap extended Set correctly', () => {
  class ExtendendSet1 extends Set<{ wrap: Ref<number> }> {
    foo = ref('foo')
    bar = 1
  }

  const eset1 = reactive(new ExtendendSet1())
  expectType<string>(eset1.foo)
  expectType<number>(eset1.bar)
})

describe('should not error when assignment', () => {
  const arr = reactive([''])
  let record: Record<number, string>
  record = arr
  expectType<string>(record[0])
  let record2: { [key: number]: string }
  record2 = arr
  expectType<string>(record2[0])
})
