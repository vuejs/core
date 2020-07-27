import { Ref, ref, isRef, unref, reactive, expectType } from './index'

function plainType(arg: number | Ref<number>) {
  // ref coercing
  const coerced = ref(arg)
  expectType<Ref<number>>(coerced)

  // isRef as type guard
  if (isRef(arg)) {
    expectType<Ref<number>>(arg)
  }

  // ref unwrapping
  expectType<number>(unref(arg))

  // ref inner type should be unwrapped
  const nestedRef = ref({
    foo: ref(1)
  })
  expectType<Ref<{ foo: number }>>(nestedRef)
  expectType<{ foo: number }>(nestedRef.value)

  // ref boolean
  const falseRef = ref(false)
  expectType<Ref<boolean>>(falseRef)
  expectType<boolean>(falseRef.value)

  // ref true
  const trueRef = ref<true>(true)
  expectType<Ref<true>>(trueRef)
  expectType<true>(trueRef.value)

  // tuple
  expectType<[number, string]>(unref(ref([1, '1'])))

  interface IteratorFoo {
    [Symbol.iterator]: any
  }

  // with symbol
  expectType<Ref<IteratorFoo | null | undefined>>(
    ref<IteratorFoo | null | undefined>()
  )

  // should not unwrap ref inside arrays
  const arr = ref([1, new Map<string, any>(), ref('1')]).value
  const value = arr[0]
  if (isRef(value)) {
    expectType<Ref>(value)
  } else if (typeof value === 'number') {
    expectType<number>(value)
  } else {
    // should narrow down to Map type
    // and not contain any Ref type
    expectType<Map<string, any>>(value)
  }

  // should still unwrap in objects nested in arrays
  const arr2 = ref([{ a: ref(1) }]).value
  expectType<number>(arr2[0].a)
}

plainType(1)

function bailType(arg: HTMLElement | Ref<HTMLElement>) {
  // ref coercing
  const coerced = ref(arg)
  expectType<Ref<HTMLElement>>(coerced)

  // isRef as type guard
  if (isRef(arg)) {
    expectType<Ref<HTMLElement>>(arg)
  }

  // ref unwrapping
  expectType<HTMLElement>(unref(arg))

  // ref inner type should be unwrapped
  // eslint-disable-next-line no-restricted-globals
  const nestedRef = ref({ foo: ref(document.createElement('DIV')) })

  expectType<Ref<{ foo: HTMLElement }>>(nestedRef)
  expectType<{ foo: HTMLElement }>(nestedRef.value)
}
// eslint-disable-next-line no-restricted-globals
const el = document.createElement('DIV')
bailType(el)

function withSymbol() {
  const customSymbol = Symbol()
  const obj = {
    [Symbol.asyncIterator]: { a: 1 },
    [Symbol.unscopables]: { b: '1' },
    [customSymbol]: { c: [1, 2, 3] }
  }

  const objRef = ref(obj)

  expectType<{ a: number }>(objRef.value[Symbol.asyncIterator])
  expectType<{ b: string }>(objRef.value[Symbol.unscopables])
  expectType<{ c: Array<number> }>(objRef.value[customSymbol])
}

withSymbol()

const state = reactive({
  foo: {
    value: 1,
    label: 'bar'
  }
})

expectType<string>(state.foo.label)
