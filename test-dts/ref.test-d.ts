import { expectType } from 'tsd'
import { Ref, ref } from './index'
import { isRef } from '@vue/reactivity'

function foo(arg: number | Ref<number>) {
  // ref coercing
  const coerced = ref(arg)
  expectType<Ref<number>>(coerced)

  // isRef as type guard
  if (isRef(arg)) {
    expectType<Ref<number>>(arg)
  }
}

foo(1)
