import {
  readonly,
  describe,
  expectError,
  reactive,
  computed,
  ComputedRef
} from './index'

describe('should support DeepReadonly', () => {
  const r = readonly({ obj: { k: 'v' } })
  // @ts-expect-error
  expectError((r.obj = {}))
  // @ts-expect-error
  expectError((r.obj.k = 'x'))
})

// #1930
describe('should unwrap the computed type', () => {
  interface Foo {
    position: number
  }

  interface Bar {
    position: number
    callback: (data: number) => void
  }

  const position: ComputedRef<number> = computed(() => 1)

  expect<Foo>(
    reactive({
      position: position
    })
  )
  expect<Bar>(
    reactive({
      position: position, // Issue happens here
      callback: (v: any) => {
        expect<any>(v)
      }
    })
  )

  expect<Bar>(
    reactive({
      position,
      // @ts-ignore ignore implicit any
      callback: _ => {}
    })
  )
})
