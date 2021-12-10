import { ref, readonly, describe, expectError, expectType, Ref } from './index'

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
