import { expectType, defineOptions, Slots, describe } from './index'

describe('no args', () => {
  const { props, attrs, emit, slots } = defineOptions()
  expectType<{}>(props)
  expectType<Record<string, unknown>>(attrs)
  expectType<(...args: any[]) => void>(emit)
  expectType<Slots>(slots)

  // @ts-expect-error
  props.foo
  // should be able to emit anything
  emit('foo')
  emit('bar')
})

describe('with type arg', () => {
  const { props, attrs, emit, slots } = defineOptions<{
    props: {
      foo: string
    }
    emit: (e: 'change') => void
  }>()

  // explicitly declared type should be refined
  expectType<string>(props.foo)
  // @ts-expect-error
  props.bar

  emit('change')
  // @ts-expect-error
  emit()
  // @ts-expect-error
  emit('bar')

  // non explicitly declared type should fallback to default type
  expectType<Record<string, unknown>>(attrs)
  expectType<Slots>(slots)
})

// with runtime arg
describe('with runtime arg (array syntax)', () => {
  const { props, emit } = defineOptions({
    props: ['foo', 'bar'],
    emits: ['foo', 'bar']
  })

  expectType<{
    foo?: any
    bar?: any
  }>(props)
  // @ts-expect-error
  props.baz

  emit('foo')
  emit('bar', 123)
  // @ts-expect-error
  emit('baz')
})

describe('with runtime arg (object syntax)', () => {
  const { props, emit } = defineOptions({
    props: {
      foo: String,
      bar: {
        type: Number,
        default: 1
      },
      baz: {
        type: Array,
        required: true
      }
    },
    emits: {
      foo: () => {},
      bar: null
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

  emit('foo')
  emit('bar')
  // @ts-expect-error
  emit('baz')
})
