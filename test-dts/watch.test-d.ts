import { ref, computed, watch } from './index'
import { expectType } from 'tsd'

const source = ref('foo')
const source2 = computed(() => source.value)
const source3 = () => 1

// eager watcher's oldValue will be undefined on first run.
watch(source, (value, oldValue) => {
  expectType<string>(value)
  expectType<string | undefined>(oldValue)
})

watch([source, source2, source3], (values, oldValues) => {
  expectType<(string | number)[]>(values)
  expectType<(string | number | undefined)[]>(oldValues)
})

// const array
watch([source, source2, source3] as const, (values, oldValues) => {
  expectType<Readonly<[string, string, number]>>(values)
  expectType<
    Readonly<[string | undefined, string | undefined, number | undefined]>
  >(oldValues)
})

// lazy watcher will have consistent types for oldValue.
watch(
  source,
  (value, oldValue) => {
    expectType<string>(value)
    expectType<string>(oldValue)
  },
  { lazy: true }
)

watch(
  [source, source2, source3],
  (values, oldValues) => {
    expectType<(string | number)[]>(values)
    expectType<(string | number)[]>(oldValues)
  },
  { lazy: true }
)

// const array
watch(
  [source, source2, source3] as const,
  (values, oldValues) => {
    expectType<Readonly<[string, string, number]>>(values)
    expectType<Readonly<[string, string, number]>>(oldValues)
  },
  { lazy: true }
)
