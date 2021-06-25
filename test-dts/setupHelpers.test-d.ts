import {
  expectType,
  defineProps,
  defineEmit,
  defineEmits,
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

describe('defineProps w/ type declaration + defaults', () => {
  defineProps<{
    number?: number
    arr?: string[]
    arr2?: string[]
    obj?: { x: number }
    obj2?: { x: number }
    obj3?: { x: number }
  }>(
    {},
    {
      number: 1,

      arr: () => [''],
      // @ts-expect-error not using factory
      arr2: [''],

      obj: () => ({ x: 123 }),
      // @ts-expect-error not using factory
      obj2: { x: 123 },
      // @ts-expect-error factory return type does not match
      obj3: () => ({ x: 'foo' })
    }
  )
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

describe('deprecated defineEmit', () => {
  const emit = defineEmit({
    foo: () => {},
    bar: null
  })
  emit('foo')
  emit('bar', 123)
  // @ts-expect-error
  emit('baz')
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
