import { expectType } from 'tsd'
import { Ref, ref, isRef, unref, UnwrapRef } from './index'

function foo(arg: number | Ref<number>) {
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

  interface IteratorFoo {
    [Symbol.iterator]: any
  }
  expectType<Ref<UnwrapRef<IteratorFoo>> | Ref<null>>(
    ref<IteratorFoo | null>(null)
  )

  expectType<Ref<HTMLElement> | Ref<null>>(ref<HTMLElement | null>(null))
}

foo(1)
