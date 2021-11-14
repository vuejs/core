import {
  expectType,
  defineProps,
  defineEmits,
  useAttrs,
  useSlots,
  withDefaults,
  Slots,
  describe
} from './index'

describe('defineProps w/ type declaration', () => {
  // type declaration
  const props = defineProps<{
    foo: string
  }>()
  // explicitly declared type should be refined
  expectType<string>(props.foo)
  // @ts-expect-error
  props.bar
})

describe('defineProps w/ type declaration + withDefaults', () => {
  const props = withDefaults(
    defineProps<{
      number?: number
      array?: string[]
      readonlyArray?: readonly string[]
      object?: { a: number }
      function?: (x: string) => void
      string?: string
      null?: null
    }>(),
    {
      number: 1,
      array: () => [],
      readonlyArray: () => [],
      object: () => ({ a: 1 }),
      function: () => {}
    }
  )

  expectType<number>(props.number)
  expectType<string[]>(props.array)
  expectType<readonly string[]>(props.readonlyArray)
  expectType<{ a: number }>(props.object)
  expectType<(x: string) => void>(props.function)
  // should remain optional if no default is given
  expectType<string | null | undefined>(props.string)
  expectType<null | undefined>(props.null)
})

describe('defineProps w/ runtime declaration', () => {
  // runtime declaration
  const props = defineProps({
    foo: String,
    bar: {
      type: Number,
      default: 1
    },
    baz: {
      type: Array,
      required: true
    }
  })
  expectType<{
    foo?: string
    bar: number
    baz: unknown[]
  }>(props)

  props.foo && props.foo + 'bar'
  props.bar + 1
  // @ts-expect-error should be readonly
  props.bar++
  props.baz.push(1)

  const props2 = defineProps(['foo', 'bar'])
  props2.foo + props2.bar
  // @ts-expect-error
  props2.baz
})

describe('defineEmits w/ type declaration', () => {
  const emit = defineEmits<(e: 'change') => void>()
  emit('change')
  // @ts-expect-error
  emit()
  // @ts-expect-error
  emit('bar')

  type Emits = { (e: 'foo' | 'bar'): void; (e: 'baz', id: number): void }
  const emit2 = defineEmits<Emits>()

  emit2('foo')
  emit2('bar')
  emit2('baz', 123)
  // @ts-expect-error
  emit2('baz')
})

describe('defineEmits w/ runtime declaration', () => {
  const emit = defineEmits({
    foo: () => {},
    bar: null
  })
  emit('foo')
  emit('bar', 123)
  // @ts-expect-error
  emit('baz')

  const emit2 = defineEmits(['foo', 'bar'])
  emit2('foo')
  emit2('bar', 123)
  // @ts-expect-error
  emit2('baz')
})

describe('useAttrs', () => {
  const attrs = useAttrs()
  expectType<Record<string, unknown>>(attrs)
})

describe('useSlots', () => {
  const slots = useSlots()
  expectType<Slots>(slots)
})
