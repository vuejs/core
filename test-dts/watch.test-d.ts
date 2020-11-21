import { ref, computed, watch, expectType } from './index'

const source = ref('foo')
const source2 = computed(() => source.value)
const source3 = () => 1

// lazy watcher will have consistent types for oldValue.
watch(source, (value, oldValue) => {
  expectType<string>(value)
  expectType<string>(oldValue)
})

// const array and normal array will be treated equally
watch([source, source2, source3], (values, oldValues) => {
  expectType<[string, string, number]>(values)
  expectType<[string, string, number]>(oldValues)
})

// const array and normal array will be treated equally
watch([source, source2, source3] as const, (values, oldValues) => {
  expectType<Readonly<[string, string, number]>>(values)
  expectType<Readonly<[string, string, number]>>(oldValues)
})

// immediate watcher's oldValue will be undefined on first run.
watch(
  source,
  (value, oldValue) => {
    expectType<string>(value)
    expectType<string | undefined>(oldValue)
  },
  { immediate: true }
)

watch(
  [source, source2, source3],
  (values, oldValues) => {
    expectType<[string, string, number]>(values)
    expectType<[string | undefined, string | undefined, number | undefined]>(
      oldValues
    )
  },
  { immediate: true }
)

// const array and normal array will be treated equally
watch(
  [source, source2, source3] as const,
  (values, oldValues) => {
    expectType<Readonly<[string, string, number]>>(values)
    expectType<
      Readonly<[string | undefined, string | undefined, number | undefined]>
    >(oldValues)
  },
  { immediate: true }
)

// should provide correct ref.value inner type to callbacks
const nestedRefSource = ref({
  foo: ref(1)
})

watch(nestedRefSource, (v, ov) => {
  expectType<{ foo: number }>(v)
  expectType<{ foo: number }>(ov)
})
