import {
  expectType,
  defineProps,
  defineEmit,
  useContext,
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

describe('defineEmit w/ type declaration', () => {
  const emit = defineEmit<(e: 'change') => void>()
  emit('change')
  // @ts-expect-error
  emit()
  // @ts-expect-error
  emit('bar')

  const emit2 = defineEmit<
    ((e: 'foo') => void) & ((e: 'bar', num: number) => void)
  >()
  emit2('foo')
  emit2('bar', 123)
  // @ts-expect-error
  emit2('foo', 123)
  // @ts-expect-error
  emit2('bar')
  // @ts-expect-error
  emit2('baz')
})

describe('defineEmit w/ runtime declaration', () => {
  const emit = defineEmit({
    foo: () => {},
    bar: null
  })
  emit('foo')
  emit('bar', 123)
  // @ts-expect-error
  emit('baz')

  const emit2 = defineEmit(['foo', 'bar'])
  emit2('foo')
  emit2('bar', 123)
  // @ts-expect-error
  emit2('baz')
})

describe('useContext', () => {
  const { attrs, emit, slots } = useContext()
  expectType<Record<string, unknown>>(attrs)
  expectType<(...args: any[]) => void>(emit)
  expectType<Slots>(slots)

  // @ts-expect-error
  props.foo
  // should be able to emit anything
  emit('foo')
  emit('bar')
})
