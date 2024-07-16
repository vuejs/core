import {
  type ComputedRef,
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
  expectType<string>(value)
  expectType<string>(oldValue)
  expectType<OnCleanup>(onCleanup)
})

watch([source, source2, source3], (values, oldValues) => {
  expectType<[string, string, number]>(values)
  expectType<[string, string, number]>(oldValues)
})

// const array
watch([source, source2, source3] as const, (values, oldValues) => {
  expectType<Readonly<[string, string, number]>>(values)
  expectType<Readonly<[string, string, number]>>(oldValues)
})

// reactive array
watch(reactive([source, source2, source3]), (value, oldValues) => {
  expectType<Bar[]>(value)
  expectType<Bar[]>(oldValues)
})

// reactive w/ readonly tuple
watch(reactive([source, source2, source3] as const), (value, oldValues) => {
  expectType<Foo>(value)
  expectType<Foo>(oldValues)
})

// readonly array
watch(readonlyArr, (values, oldValues) => {
  expectType<Readonly<[string, string, number]>>(values)
  expectType<Readonly<[string, string, number]>>(oldValues)
})

// no type error, case from vueuse
declare const aAny: any
watch(aAny, (v, ov) => {})
watch(aAny, (v, ov) => {}, { immediate: true })

// immediate watcher's oldValue will be undefined on first run.
watch(
  source,
  (value, oldValue) => {
    expectType<string>(value)
    expectType<string | undefined>(oldValue)
  },
  { immediate: true },
)

watch(
  [source, source2, source3],
  (values, oldValues) => {
    expectType<[string, string, number]>(values)
    expectType<[string | undefined, string | undefined, number | undefined]>(
      oldValues,
    )
  },
  { immediate: true },
)

// const array
watch(
  [source, source2, source3] as const,
  (values, oldValues) => {
    expectType<Readonly<[string, string, number]>>(values)
    expectType<
      Readonly<[string | undefined, string | undefined, number | undefined]>
    >(oldValues)
  },
  { immediate: true },
)

// reactive array
watch(
  reactive([source, source2, source3]),
  (value, oldVals) => {
    expectType<Bar[]>(value)
    expectType<Bar[] | undefined>(oldVals)
  },
  { immediate: true },
)

// reactive w/ readonly tuple
watch(reactive([source, source2, source3] as const), (value, oldVals) => {
  expectType<Foo>(value)
  expectType<Foo | undefined>(oldVals)
})

// readonly array
watch(
  readonlyArr,
  (values, oldValues) => {
    expectType<Readonly<[string, string, number]>>(values)
    expectType<
      Readonly<[string | undefined, string | undefined, number | undefined]>
    >(oldValues)
  },
  { immediate: true },
)

// should provide correct ref.value inner type to callbacks
const nestedRefSource = ref({
  foo: ref(1),
})

watch(nestedRefSource, (v, ov) => {
  expectType<{ foo: number }>(v)
  expectType<{ foo: number }>(ov)
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
        expectType<number>(v)
        expectType<number>(ov)
        expectType<OnCleanup>(onCleanup)
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
    expectType<Steps>(value)
  })
  watch(shallowUnionAsCast, value => {
    expectType<Steps>(value)
  })
}

{
  // defineModel
  const bool = defineModel({ default: false })
  watch(bool, value => {
    expectType<boolean>(value)
  })

  const bool1 = defineModel<boolean>()
  watch(bool1, value => {
    expectType<boolean | undefined>(value)
  })

  const msg = defineModel<string>({ required: true })
  watch(msg, value => {
    expectType<string>(value)
  })

  const arr = defineModel<string[]>({ required: true })
  watch(arr, value => {
    expectType<string[]>(value)
  })

  const obj = defineModel<{ foo: string }>({ required: true })
  watch(obj, value => {
    expectType<{ foo: string }>(value)
  })
}
