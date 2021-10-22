import {
  ref,
  readonly,
  describe,
  expectError,
  expectType,
  Ref,
  reactive
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

describe('should unwrap tuple correctly', () => {
  const readonlyTuple = [ref(0)] as const
  const reactiveReadonlyTuple = reactive(readonlyTuple)
  expectType<Ref<number>>(reactiveReadonlyTuple[0])

  const tuple: [Ref<number>] = [ref(0)]
  const reactiveTuple = reactive(tuple)
  expectType<Ref<number>>(reactiveTuple[0])
})
