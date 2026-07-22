import {
  type Attrs,
  type ModelRef,
  type Ref,
  type Slots,
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
import { describe, expectAssignable, expectType } from './utils'

describe('defineProps w/ type declaration', () => {
  // type declaration
  const props = defineProps<{
    foo: string
    bool?: boolean
    boolAndUndefined: boolean | undefined
    file?: File | File[]
  }>()
  // explicitly declared type should be refined
  expectType(props.foo, {} as string)
  // @ts-expect-error
  props.bar

  expectType(props.bool, {} as boolean)
  expectType(props.boolAndUndefined, {} as boolean)
})

describe('defineProps w/ never prop', () => {
  const props = defineProps<{
    foo?: never
    bar: number
  }>()

  expectType(props.foo, {} as unknown as never | undefined)
  expectType(props.bar, {} as number)
})

describe('defineProps w/ generics', () => {
  function test<T extends boolean>() {
    const props = defineProps<{ foo: T; bar: string; x?: boolean }>()
    expectType(props.foo, {} as T)
    expectType(props.bar, {} as string)
    expectType(props.x, {} as boolean)
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

  expectType(res.x, {} as string | undefined)
  expectType(res.y, {} as string | undefined)
  expectType(res.z, {} as string)
  expectAssignable<T>(res.foo)

  expectType(res.bool, {} as boolean)
  expectType(res.boolAndUndefined, {} as boolean)
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

  expectAssignable<
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
    expectType(props.v, {} as string)
  }
  if (props.mode === 'multiple') {
    expectType(props.v, {} as string[])
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

  expectType(res.generic1, {} as T[] | { x: T })
  expectType(res.generic2, {} as { x: T })
  expectAssignable<TString>(res.generic3)
  expectAssignable<TA>(res.generic4)

  expectType(res.bool, {} as boolean)
})

describe('withDefaults w/ boolean type', () => {
  const res1 = withDefaults(
    defineProps<{
      bool?: boolean
    }>(),
    { bool: false },
  )
  expectType(res1.bool, {} as boolean)

  const res2 = withDefaults(
    defineProps<{
      bool?: boolean
    }>(),
    {
      bool: undefined,
    },
  )
  expectType(res2.bool, {} as boolean | undefined)
})

describe('withDefaults w/ defineProp type is different from the defaults type', () => {
  const res1 = withDefaults(
    defineProps<{
      bool?: boolean
    }>(),
    { bool: false, value: false },
  )
  expectType(res1.bool, {} as boolean)

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
    expectType(props.buttonType, {} as 'submit' | undefined)
  }
  if (props.type === 'link') {
    expectType(props.href, {} as string)
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
  expectType(
    props,
    {} as {
      readonly foo?: string
      readonly bar: number
      readonly baz: unknown[]
    },
  )

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
  expectType(
    fnSlots.default,
    {} as (props: { foo: string; bar: number }) => any,
  )
  expectType(fnSlots.optional, {} as ((props: string) => any) | undefined)

  const untypedSlots = defineSlots()
  expectAssignable<Slots>(untypedSlots)
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
  expectType(modelValueRequired, {} as ModelRef<boolean>)

  // overload 2
  const modelValue = defineModel<string>()
  expectType(modelValue, {} as ModelRef<string | undefined>)
  modelValue.value = 'new value'

  const modelValueDefault = defineModel<boolean>({ default: true })
  expectType(modelValueDefault, {} as ModelRef<boolean>)

  // overload 3
  const countRequired = defineModel<number>('count', { required: false })
  expectType(countRequired, {} as ModelRef<number | undefined>)

  // overload 4
  const count = defineModel<number>('count')
  expectType(count, {} as ModelRef<number | undefined>)

  const countDefault = defineModel<number>('count', { default: 1 })
  expectType(countDefault, {} as ModelRef<number>)

  const arrayDefault = defineModel<number[]>({ default: () => [] })
  expectType(arrayDefault, {} as ModelRef<number[]>)

  const objectDefault = defineModel<{ foo: string }>({
    default: () => ({ foo: 'bar' }),
  })
  expectType(objectDefault, {} as ModelRef<{ foo: string }>)

  // infer type from default
  const inferred = defineModel({ default: 123 })
  expectAssignable<Ref<number | undefined>>(inferred)
  const inferredRequired = defineModel({ default: 123, required: true })
  expectAssignable<Ref<number>>(inferredRequired)

  // modifiers
  const [_, modifiers] = defineModel<string>()
  expectType(modifiers.foo, {} as true | undefined)

  // limit supported modifiers
  const [__, typedModifiers] = defineModel<string, 'trim' | 'capitalize'>()
  expectType(typedModifiers.trim, {} as true | undefined)
  expectType(typedModifiers.capitalize, {} as true | undefined)
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
  // @ts-expect-error raw array defaults must use a factory
  defineModel<number[]>({ default: [] })
  // @ts-expect-error raw object defaults must use a factory
  defineModel<{ foo: string }>({ default: { foo: 'bar' } })
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
    expectType(modelVal.value, {} as string | undefined)
    modelVal.value = 1
    modelVal.value = undefined
    // @ts-expect-error
    modelVal.value = 'foo'

    const [modelVal2] = modelVal
    expectType(modelVal2.value, {} as string | undefined)
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
    expectType(count.value, {} as string | undefined)
    count.value = 1
    count.value = undefined
    // @ts-expect-error
    count.value = 'foo'

    const [count2] = count
    expectType(count2.value, {} as string | undefined)
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
      expectType(r, {} as ModelRef<any, PropertyKey>)

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
      expectType(
        useModel(props, 'foo'),
        {} as ModelRef<string | undefined, PropertyKey>,
      )
      expectType(useModel(props, 'bar'), {} as ModelRef<number, PropertyKey>)
      expectType(useModel(props, 'baz'), {} as ModelRef<boolean, PropertyKey>)
    },
  })
})

describe('useAttrs', () => {
  const attrs = useAttrs()
  expectType(attrs, {} as Attrs)
})

describe('useSlots', () => {
  const slots = useSlots()
  expectType(slots, {} as Slots)
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
  expectType(toRefs(props).file, {} as Ref<File | File[] | undefined>)
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
