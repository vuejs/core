import { expectType } from 'tsd'
import { Ref, ref, isRef, unref, reactive } from './index'

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
  const nestedRef = ref({ foo: ref(document.createElement('DIV')) })

  expectType<Ref<{ foo: HTMLElement }>>(nestedRef)
  expectType<{ foo: HTMLElement }>(nestedRef.value)
}
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

function generics<TGeneric extends { a: 1 }>() {
  ;(function unknownGeneric<T>(v: T) {
    const r = ref(v)
    expectType<any>(r.value) // T in this case can be anything
  })
  ;(function stringGeneric<T extends string>(v: T) {
    const r = ref(v)
    expectType<string>(r.value)
  })
  ;(function assignedGeneric<T = TGeneric>(v: T) {
    const r = ref(v)
    expectType<any>(r.value) // T in this case can be anything
  })
  ;(function extendsGeneric<T extends TGeneric>(v: T) {
    const r = ref(v)
    expectType<{ a: 1 }>(r.value) // this will infer the actual type instead of being generic
  })
  ;(function functionGeneric<T extends (a: number, b: string) => number>(v: T) {
    const r = ref(v)
    expectType<(a: number, b: string) => number>(r.value) // this will infer the actual type instead of being generic
  })
  ;(function arrayGeneric<T extends Array<number>>(v: T) {
    const r = ref(v)
    expectType<Array<number>>(r.value)
  })
  ;(function tupleGeneric<T extends [number, string]>(v: T) {
    const r = ref(v)
    expectType<[number, string]>(r.value)
  })
}

generics()

const state = reactive({
  foo: {
    value: 1,
    label: 'bar'
  }
})

expectType<string>(state.foo.label)
