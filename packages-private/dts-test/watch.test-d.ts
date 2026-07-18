import {
  type ComputedRef,
  type MaybeRef,
  type Reactive,
  type Ref,
  computed,
  defineComponent,
  defineModel,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { expectType } from './utils'

const source = ref('foo')
const source2 = computed(() => source.value)
const source3 = () => 1

type Bar = Ref<string> | ComputedRef<string> | (() => number)
type Foo = readonly [Ref<string>, ComputedRef<string>, () => number]
type OnCleanup = (fn: () => void) => void

const readonlyArr: Foo = [source, source2, source3]

// lazy watcher will have consistent types for oldValue.
watch(source, (value, oldValue, onCleanup) => {
  expectType(value, {} as string)
  expectType(oldValue, {} as string)
  expectType(onCleanup, {} as OnCleanup)
})

watch([source, source2, source3], (values, oldValues) => {
  expectType(values, {} as [string, string, number])
  expectType(oldValues, {} as [string, string, number])
})

// const array
watch([source, source2, source3] as const, (values, oldValues) => {
  expectType(values, {} as [string, string, number])
  expectType(oldValues, {} as [string, string, number])
})

// reactive array
watch(reactive([source, source2, source3]), (value, oldValues) => {
  expectType(value, {} as Reactive<Bar[]>)
  expectType(oldValues, {} as Reactive<Bar[]>)
})

// reactive w/ readonly tuple
watch(reactive([source, source2, source3] as const), (value, oldValues) => {
  expectType(value, {} as Reactive<Foo>)
  expectType(oldValues, {} as Reactive<Foo>)
})

// readonly array
watch(readonlyArr, (values, oldValues) => {
  expectType(values, {} as [string, string, number])
  expectType(oldValues, {} as [string, string, number])
})

// no type error, case from vueuse
declare const aAny: any
watch(aAny, (v, ov) => {})
watch(aAny, (v, ov) => {}, { immediate: true })

// immediate watcher's oldValue will be undefined on first run.
watch(
  source,
  (value, oldValue) => {
    expectType(value, {} as string)
    expectType(oldValue, {} as string | undefined)
  },
  { immediate: true },
)

watch(
  [source, source2, source3],
  (values, oldValues) => {
    expectType(values, {} as [string, string, number])
    expectType(
      oldValues,
      {} as [string | undefined, string | undefined, number | undefined],
    )
  },
  { immediate: true },
)

// const array
watch(
  [source, source2, source3] as const,
  (values, oldValues) => {
    expectType(values, {} as [string, string, number])
    expectType(
      oldValues,
      {} as [string | undefined, string | undefined, number | undefined],
    )
  },
  { immediate: true },
)

// reactive array
watch(
  reactive([source, source2, source3]),
  (value, oldVals) => {
    expectType(value, {} as Reactive<Bar[]>)
    expectType(oldVals, {} as Reactive<Bar[]> | undefined)
  },
  { immediate: true },
)

// reactive w/ readonly tuple
watch(
  reactive([source, source2, source3] as const),
  (value, oldVals) => {
    expectType(value, {} as Reactive<Foo>)
    expectType(oldVals, {} as Reactive<Foo> | undefined)
  },
  { immediate: true },
)

// readonly array
watch(
  readonlyArr,
  (values, oldValues) => {
    expectType(values, {} as [string, string, number])
    expectType(
      oldValues,
      {} as [string | undefined, string | undefined, number | undefined],
    )
  },
  { immediate: true },
)

// should provide correct ref.value inner type to callbacks
const nestedRefSource = ref({
  foo: ref(1),
})

watch(nestedRefSource, (v, ov) => {
  expectType(v, {} as { foo: number })
  expectType(ov, {} as { foo: number })
})

const someRef = ref({ test: 'test' })
const otherRef = ref({ a: 'b' })
watch([someRef, otherRef], values => {
  const value1 = values[0]
  // no type error
  console.log(value1.test)

  const value2 = values[1]
  // no type error
  console.log(value2.a)
})

// #6135
defineComponent({
  data() {
    return { a: 1 }
  },
  created() {
    this.$watch(
      () => this.a,
      (v, ov, onCleanup) => {
        expectType(v, {} as number)
        expectType(ov, {} as number)
        expectType(onCleanup, {} as OnCleanup)
      },
    )
  },
})

{
  //#7852
  type Steps = { step: '1' } | { step: '2' }
  const shallowUnionGenParam = shallowRef<Steps>({ step: '1' })
  const shallowUnionAsCast = shallowRef({ step: '1' } as Steps)

  watch(shallowUnionGenParam, value => {
    expectType(value, {} as Steps)
  })
  watch(shallowUnionAsCast, value => {
    expectType(value, {} as Steps)
  })
}

{
  // defineModel
  const bool = defineModel({ default: false })
  watch(bool, value => {
    expectType(value, {} as false)
  })

  const bool1 = defineModel<boolean>()
  watch(bool1, value => {
    expectType(value, {} as boolean | undefined)
  })

  const msg = defineModel<string>({ required: true })
  watch(msg, value => {
    expectType(value, {} as string)
  })

  const arr = defineModel<string[]>({ required: true })
  watch(arr, value => {
    expectType(value, {} as string[])
  })

  const obj = defineModel<{ foo: string }>({ required: true })
  watch(obj, value => {
    expectType(value, {} as { foo: string })
  })
}

{
  const css: MaybeRef<string> = ''
  watch(ref(css), value => {
    expectType(value, {} as string)
  })
}
