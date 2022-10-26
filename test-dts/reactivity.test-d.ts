import {
  ref,
  readonly,
  shallowReadonly,
  describe,
  expectError,
  expectType,
  Ref,
  reactive,
  markRaw
} from './index'

describe('should support DeepReadonly', () => {
  const r = readonly({ obj: { k: 'v' } })
  // @ts-expect-error
  expectError((r.obj = {}))
  // @ts-expect-error
  expectError((r.obj.k = 'x'))
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
    ref: ref(1)
  }

  const r = reactive({
    class: {
      raw: markRaw(test),
      reactive: test
    },
    plain: {
      raw: markRaw(plain),
      reactive: plain
    }
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
