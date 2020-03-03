import { expectType } from 'tsd'
import { Ref, ref, isRef, unref } from './index'

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
}

foo(1)
