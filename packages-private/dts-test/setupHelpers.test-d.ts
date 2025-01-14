import {
  type Ref,
  type Slots,
  type VNode,
  defineComponent,
  defineEmits,
  defineModel,
  defineOptions,
  defineProps,
  defineSlots,
  toRefs,
  useAttrs,
  useModel,
  useSlots,
  withDefaults,
} from 'vue'
import { describe, expectType } from './utils'

describe('defineProps w/ type declaration', () => {
  // type declaration
  const props = defineProps<{
    foo: string
    bool?: boolean
    boolAndUndefined: boolean | undefined
    file?: File | File[]
  }>()
  // explicitly declared type should be refined
  expectType<string>(props.foo)
  // @ts-expect-error
  props.bar

  expectType<boolean>(props.bool)
  expectType<boolean>(props.boolAndUndefined)
})

describe('defineProps w/ generics', () => {
  function test<T extends boolean>() {
    const props = defineProps<{ foo: T; bar: string; x?: boolean }>()
    expectType<T>(props.foo)
    expectType<string>(props.bar)
    expectType<boolean>(props.x)
  }
  test()
})

describe('defineProps w/ type declaration + withDefaults', <T extends
  string>() => {
  const res = withDefaults(
    defineProps<{
      number?: number
      arr?: string[]
      obj?: { x: number }
      fn?: (e: string) => void
      genStr?: string
      x?: string
      y?: string
      z?: string
      bool?: boolean
      boolAndUndefined: boolean | undefined
      foo?: T
    }>(),
    {
      number: 123,
      arr: () => [],
      obj: () => ({ x: 123 }),
      fn: () => {},
      genStr: () => '',
      y: undefined,
      z: 'string',
      foo: '' as any,
    },
  )

  res.number + 1
  res.arr.push('hi')
  res.obj.x
  res.fn('hi')
  res.genStr.slice()
  // @ts-expect-error
  res.x.slice()
  // @ts-expect-error
  res.y.slice()

  expectType<string | undefined>(res.x)
  expectType<string | undefined>(res.y)
  expectType<string>(res.z)
  expectType<T>(res.foo)

  expectType<boolean>(res.bool)
  expectType<boolean>(res.boolAndUndefined)
})

describe('defineProps w/ union type declaration + withDefaults', () => {
  withDefaults(
    defineProps<{
      union1?: number | number[] | { x: number }
      union2?: number | number[] | { x: number }
      union3?: number | number[] | { x: number }
      union4?: number | number[] | { x: number }
    }>(),
    {
      union1: 123,
      union2: () => [123],
      union3: () => ({ x: 123 }),
      union4: () => 123,
    },
  )
})

describe('defineProps w/ object union + withDefaults', () => {
  const props = withDefaults(
    defineProps<
      {
        foo: string
      } & (
        | {
            type: 'hello'
            bar: string
          }
        | {
            type: 'world'
            bar: number
          }
      )
    >(),
    {
      foo: 'default value!',
    },
  )

  expectType<
    | {
        readonly type: 'hello'
        readonly bar: string
        readonly foo: string
      }
    | {
        readonly type: 'world'
        readonly bar: number
        readonly foo: string
      }
  >(props)
})

describe('defineProps w/ generic discriminate union + withDefaults', () => {
  interface B {
    b?: string
  }
  interface S<T> extends B {
    mode: 'single'
    v: T
  }
  interface M<T> extends B {
    mode: 'multiple'
    v: T[]
  }
  type Props = S<string> | M<string>
  const props = withDefaults(defineProps<Props>(), {
    b: 'b',
  })

  if (props.mode === 'single') {
    expectType<string>(props.v)
  }
  if (props.mode === 'multiple') {
    expectType<string[]>(props.v)
  }
})

describe('defineProps w/ generic type declaration + withDefaults', <T extends
  number, TA extends {
  a: string
}, TString extends string>() => {
  const res = withDefaults(
    defineProps<{
      n?: number
      bool?: boolean
      s?: string

      generic1?: T[] | { x: T }
      generic2?: { x: T }
      generic3?: TString
      generic4?: TA
    }>(),
    {
      n: 123,

      generic1: () => [123, 33] as T[],
      generic2: () => ({ x: 123 }) as { x: T },

      generic3: () => 'test' as TString,
      generic4: () => ({ a: 'test' }) as TA,
    },
  )

  res.n + 1
  // @ts-expect-error should be readonly
  res.n++
  // @ts-expect-error should be readonly
  res.s = ''

  expectType<T[] | { x: T }>(res.generic1)
  expectType<{ x: T }>(res.generic2)
  expectType<TString>(res.generic3)
  expectType<TA>(res.generic4)

  expectType<boolean>(res.bool)
})

describe('withDefaults w/ boolean type', () => {
  const res1 = withDefaults(
    defineProps<{
      bool?: boolean
    }>(),
    { bool: false },
  )
  expectType<boolean>(res1.bool)

  const res2 = withDefaults(
    defineProps<{
      bool?: boolean
    }>(),
    {
      bool: undefined,
    },
  )
  expectType<boolean | undefined>(res2.bool)
})

describe('withDefaults w/ defineProp type is different from the defaults type', () => {
  const res1 = withDefaults(
    defineProps<{
      bool?: boolean
    }>(),
    { bool: false, value: false },
  )
  expectType<boolean>(res1.bool)

  // @ts-expect-error
  res1.value
})

describe('withDefaults w/ defineProp discriminate union type', () => {
  const props = withDefaults(
    defineProps<
      { type: 'button'; buttonType?: 'submit' } | { type: 'link'; href: string }
    >(),
    {
      type: 'button',
    },
  )
  if (props.type === 'button') {
    expectType<'submit' | undefined>(props.buttonType)
  }
  if (props.type === 'link') {
    expectType<string>(props.href)
  }
})

describe('defineProps w/ runtime declaration', () => {
  // runtime declaration
  const props = defineProps({
    foo: String,
    bar: {
      type: Number,
      default: 1,
    },
    baz: {
      type: Array,
      required: true,
    },
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

describe('defineEmits w/ interface declaration', () => {
  interface Emits {
    foo: [value: string]
  }
  const emit = defineEmits<Emits>()
  emit('foo', 'hi')
})

describe('defineEmits w/ alt type declaration', () => {
  const emit = defineEmits<{
    foo: [id: string]
    bar: any[]
    baz: []
  }>()

  emit('foo', 'hi')
  // @ts-expect-error
  emit('foo')

  emit('bar')
  emit('bar', 1, 2, 3)

  emit('baz')
  // @ts-expect-error
  emit('baz', 1)
})

describe('defineEmits w/ runtime declaration', () => {
  const emit = defineEmits({
    foo: () => {},
    bar: null,
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

describe('defineSlots', () => {
  // literal fn syntax (allow for specifying return type)
  const fnSlots = defineSlots<{
    default(props: { foo: string; bar: number }): any
    optional?(props: string): any
  }>()
  expectType<(scope: { foo: string; bar: number }) => VNode[]>(fnSlots.default)
  expectType<undefined | ((scope: string) => VNode[])>(fnSlots.optional)

  const slotsUntype = defineSlots()
  expectType<Slots>(slotsUntype)
})

describe('defineSlots generic', <T extends Record<string, any>>() => {
  const props = defineProps<{
    item: T
  }>()

  const slots = defineSlots<
    {
      [K in keyof T as `slot-${K & string}`]?: (props: { item: T }) => any
    } & {
      label?: (props: { item: T }) => any
    }
  >()

  for (const key of Object.keys(props.item) as (keyof T & string)[]) {
    slots[`slot-${String(key)}`]?.({
      item: props.item,
    })
  }
  slots.label?.({ item: props.item })

  // @ts-expect-error calling wrong slot
  slots.foo({})
})

describe('defineModel', () => {
  // overload 1
  const modelValueRequired = defineModel<boolean>({ required: true })
  expectType<Ref<boolean>>(modelValueRequired)

  // overload 2
  const modelValue = defineModel<string>()
  expectType<Ref<string | undefined>>(modelValue)
  modelValue.value = 'new value'

  const modelValueDefault = defineModel<boolean>({ default: true })
  expectType<Ref<boolean>>(modelValueDefault)

  // overload 3
  const countRequired = defineModel<number>('count', { required: false })
  expectType<Ref<number | undefined>>(countRequired)

  // overload 4
  const count = defineModel<number>('count')
  expectType<Ref<number | undefined>>(count)

  const countDefault = defineModel<number>('count', { default: 1 })
  expectType<Ref<number>>(countDefault)

  // infer type from default
  const inferred = defineModel({ default: 123 })
  expectType<Ref<number | undefined>>(inferred)
  const inferredRequired = defineModel({ default: 123, required: true })
  expectType<Ref<number>>(inferredRequired)

  // modifiers
  const [_, modifiers] = defineModel<string>()
  expectType<true | undefined>(modifiers.foo)

  // limit supported modifiers
  const [__, typedModifiers] = defineModel<string, 'trim' | 'capitalize'>()
  expectType<true | undefined>(typedModifiers.trim)
  expectType<true | undefined>(typedModifiers.capitalize)
  // @ts-expect-error
  typedModifiers.foo

  // transformers with type
  defineModel<string>({
    get(val) {
      return val.toLowerCase()
    },
    set(val) {
      return val.toUpperCase()
    },
  })
  // transformers with runtime type
  defineModel({
    type: String,
    get(val) {
      return val.toLowerCase()
    },
    set(val) {
      return val.toUpperCase()
    },
  })

  // @ts-expect-error type / default mismatch
  defineModel<string>({ default: 123 })
  // @ts-expect-error unknown props option
  defineModel({ foo: 123 })

  // unrelated getter and setter types
  {
    const modelVal = defineModel({
      get(_: string[]): string {
        return ''
      },
      set(_: number) {
        return 1
      },
    })
    expectType<string | undefined>(modelVal.value)
    modelVal.value = 1
    modelVal.value = undefined
    // @ts-expect-error
    modelVal.value = 'foo'

    const [modelVal2] = modelVal
    expectType<string | undefined>(modelVal2.value)
    modelVal2.value = 1
    modelVal2.value = undefined
    // @ts-expect-error
    modelVal.value = 'foo'

    const count = defineModel('count', {
      get(_: string[]): string {
        return ''
      },
      set(_: number) {
        return ''
      },
    })
    expectType<string | undefined>(count.value)
    count.value = 1
    count.value = undefined
    // @ts-expect-error
    count.value = 'foo'

    const [count2] = count
    expectType<string | undefined>(count2.value)
    count2.value = 1
    count2.value = undefined
    // @ts-expect-error
    count2.value = 'foo'
  }
})

describe('useModel', () => {
  defineComponent({
    props: ['foo'],
    setup(props) {
      const r = useModel(props, 'foo')
      expectType<Ref<any>>(r)

      // @ts-expect-error
      useModel(props, 'bar')
    },
  })

  defineComponent({
    props: {
      foo: String,
      bar: { type: Number, required: true },
      baz: { type: Boolean },
    },
    setup(props) {
      expectType<Ref<string | undefined>>(useModel(props, 'foo'))
      expectType<Ref<number>>(useModel(props, 'bar'))
      expectType<Ref<boolean>>(useModel(props, 'baz'))
    },
  })
})

describe('useAttrs', () => {
  const attrs = useAttrs()
  expectType<Record<string, unknown>>(attrs)
})

describe('useSlots', () => {
  const slots = useSlots()
  expectType<Slots>(slots)
})

describe('defineSlots generic', <T extends Record<string, any>>() => {
  const props = defineProps<{
    item: T
  }>()

  const slots = defineSlots<
    {
      [K in keyof T as `slot-${K & string}`]?: (props: { item: T }) => any
    } & {
      label?: (props: { item: T }) => any
    }
  >()

  // @ts-expect-error slots should be readonly
  slots.label = () => {}

  // @ts-expect-error non existing slot
  slots['foo-asdas']?.({
    item: props.item,
  })
  for (const key in props.item) {
    slots[`slot-${String(key)}`]?.({
      item: props.item,
    })
    slots[`slot-${String(key as keyof T)}`]?.({
      item: props.item,
    })
  }

  for (const key of Object.keys(props.item) as (keyof T)[]) {
    slots[`slot-${String(key)}`]?.({
      item: props.item,
    })
  }
  slots.label?.({ item: props.item })

  // @ts-expect-error calling wrong slot
  slots.foo({})
})

describe('defineSlots generic strict', <T extends {
  foo: 'foo'
  bar: 'bar'
}>() => {
  const props = defineProps<{
    item: T
  }>()

  const slots = defineSlots<
    {
      [K in keyof T as `slot-${K & string}`]?: (props: { item: T }) => any
    } & {
      label?: (props: { item: T }) => any
    }
  >()

  // slot-bar/foo should be automatically inferred
  slots['slot-bar']?.({ item: props.item })
  slots['slot-foo']?.({ item: props.item })

  slots.label?.({ item: props.item })

  // @ts-expect-error not part of the extends
  slots['slot-RANDOM']?.({ item: props.item })

  // @ts-expect-error slots should be readonly
  slots.label = () => {}

  // @ts-expect-error calling wrong slot
  slots.foo({})
})

// #6420
describe('toRefs w/ type declaration', () => {
  const props = defineProps<{
    file?: File | File[]
  }>()
  expectType<Ref<File | File[] | undefined>>(toRefs(props).file)
})

describe('defineOptions', () => {
  defineOptions({
    name: 'MyComponent',
    inheritAttrs: true,
  })

  defineOptions({
    // @ts-expect-error props should be defined via defineProps()
    props: ['props'],
    // @ts-expect-error emits should be defined via defineEmits()
    emits: ['emits'],
    // @ts-expect-error slots should be defined via defineSlots()
    slots: { default: 'default' },
    // @ts-expect-error expose should be defined via defineExpose()
    expose: ['expose'],
  })
})
