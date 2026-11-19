import {
  type DefineProps,
  type PropType,
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
import { type IsAny, describe, expectType } from './utils'

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

describe('defineProps w/ never prop', () => {
  const props = defineProps<{
    foo?: never
    bar: number
  }>()

  expectType<never | undefined>(props.foo)
  expectType<number>(props.bar)
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

describe('defineProps preserves generic array element types in toRefs', <T extends
  string | number>() => {
  const props = defineProps<{
    existingRef: Ref<number>
    options: readonly { value: T }[]
    value: T
  }>()
  const { existingRef, options } = toRefs(props)

  expectType<T | undefined>(
    options.value.find(item => item.value === props.value)?.value,
  )
  expectType<Ref<number>>(existingRef)
})

describe('toRefs preserves unconstrained generic props', <T>() => {
  const props = defineProps<{
    options: readonly { value: T }[]
    value: T
  }>()
  const options = toRefs(props).options
  expectType<false>(null! as IsAny<(typeof options.value)[number]>)
  expectType<T | undefined>(
    options.value.find(item => item.value === props.value)?.value,
  )

  const defaulted = withDefaults(
    defineProps<{
      label?: string
      options?: readonly { value: T }[]
      value: T
    }>(),
    { label: 'Choose', options: () => [] },
  )
  const defaultedOptions = toRefs(defaulted).options
  expectType<false>(null! as IsAny<(typeof defaultedOptions.value)[number]>)
  expectType<T | undefined>(
    defaultedOptions.value.find(item => item.value === defaulted.value)?.value,
  )
})

describe('toRefs preserves generic props that can be Boolean', <T extends
  string | boolean>() => {
  const props = defineProps<{
    options: readonly { value: T }[]
    value: T
  }>()
  const options = toRefs(props).options
  expectType<false>(null! as IsAny<(typeof options.value)[number]>)
  expectType<T | undefined>(
    options.value.find(item => item.value === props.value)?.value,
  )

  const defaulted = withDefaults(
    defineProps<{
      label?: string
      options?: readonly { value: T }[]
      value: T
    }>(),
    { label: 'Choose', options: () => [] },
  )
  const defaultedOptions = toRefs(defaulted).options
  expectType<false>(null! as IsAny<(typeof defaultedOptions.value)[number]>)
  expectType<T | undefined>(
    defaultedOptions.value.find(item => item.value === defaulted.value)?.value,
  )
})

describe('defineProps preserves inference of Boolean keys from its return type', () => {
  // Downstream utilities such as @verter/types match the public alias.
  type ExtractBooleanKeys<T> =
    T extends DefineProps<T, infer BKeys extends keyof T> ? BKeys : never
  type MakeBooleanOptional<T> =
    T extends DefineProps<T, infer BKeys extends keyof T>
      ? Omit<T, BKeys> & {
          [K in keyof T as K extends BKeys ? K : never]?: T[K] | undefined
        }
      : T

  function setup<T extends string | number>() {
    const props = defineProps<{
      active?: boolean
      options: readonly { value: T }[]
      title?: string
      value: T
    }>()
    const { options } = toRefs(props)

    expectType<T | undefined>(
      options.value.find(item => item.value === props.value)?.value,
    )
    return props
  }

  const props = setup<string>()
  type BooleanKeys = ExtractBooleanKeys<typeof props>
  expectType<BooleanKeys>('active')
  expectType<'active'>(null! as BooleanKeys)
  // @ts-expect-error non-Boolean fields are not included
  expectType<BooleanKeys>('title')
  expectType<MakeBooleanOptional<typeof props>>({
    options: [],
    title: undefined,
    value: 'example',
  })
  // @ts-expect-error the array prop is still required for callers
  expectType<MakeBooleanOptional<typeof props>>({
    title: undefined,
    value: 'example',
  })
  expectType<'active' | 'options' | 'title' | 'value'>(
    null! as keyof typeof props,
  )
})

describe('DefineProps preserves explicit Boolean keys', () => {
  type Props = { active?: boolean; visible?: boolean }
  const withoutBooleanKeys: DefineProps<Props, never> = {}
  const withOneBooleanKey: DefineProps<Props, 'active'> = { active: true }
  expectType<boolean | undefined>(withoutBooleanKeys.active)
  expectType<boolean>(withOneBooleanKey.active)
  // @ts-expect-error only the explicitly selected key is refined
  expectType<boolean>(withOneBooleanKey.visible)
})

describe('DefineProps preserves generic structural assignability', <T, K extends
  keyof T>() => {
  type StructuralProps = Readonly<T> & { readonly [P in K]-?: boolean }

  expectType<StructuralProps>(null! as DefineProps<T, K>)
  expectType<DefineProps<T, K>>(null! as StructuralProps)
})

describe('defineProps preserves Boolean casting and disjoint field types', () => {
  const props = defineProps<{
    optionalBoolean?: boolean
    optionalFalse?: false
    optionalTrue?: true
    optionalUndefined?: undefined
    optionalNever?: never
    optionalUnknown?: unknown
    optionalMixed?: string | boolean
    optionalAny?: any
  }>()

  expectType<boolean>(props.optionalBoolean)
  expectType<false>(props.optionalFalse)
  expectType<true>(props.optionalTrue)
  expectType<undefined>(props.optionalUndefined)
  expectType<undefined>(props.optionalNever)
  expectType<unknown>(props.optionalUnknown)
  expectType<string | boolean | undefined>(props.optionalMixed)
  // @ts-expect-error a union with a non-Boolean member remains optional
  expectType<string | boolean>(props.optionalMixed)

  // Any-valued props retain the previous Boolean-key treatment.
  type ExtractBooleanKeys<T> =
    T extends DefineProps<T, infer BKeys extends keyof T> ? BKeys : never
  type BooleanKeys = ExtractBooleanKeys<typeof props>
  expectType<BooleanKeys>('optionalAny')
  expectType<BooleanKeys>('optionalBoolean')
  expectType<BooleanKeys>('optionalFalse')
  expectType<BooleanKeys>('optionalTrue')
  expectType<
    'optionalAny' | 'optionalBoolean' | 'optionalFalse' | 'optionalTrue'
  >(null! as BooleanKeys)
})

describe('withDefaults preserves generic props and their refs', <T extends
  string | number>() => {
  const props = withDefaults(
    defineProps<{
      options?: readonly { value: T }[]
      value: T
      label?: string
      description?: string
      enabled?: boolean
      disabled?: boolean
      literal?: true
      existingRef?: Ref<number>
    }>(),
    {
      options: () => [],
      label: 'Choose an option',
      disabled: undefined,
    },
  )
  const { options } = toRefs(props)

  expectType<T | undefined>(
    options.value.find(item => item.value === props.value)?.value,
  )
  expectType<string>(props.label)
  expectType<string | undefined>(props.description)
  expectType<boolean>(props.enabled)
  expectType<true>(props.literal)
  // @ts-expect-error an explicit undefined default disables Boolean casting
  expectType<boolean>(props.disabled)
  expectType<boolean | undefined>(props.disabled)
  expectType<number | undefined>(props.existingRef?.value)
})

describe('withDefaults retains the raw prop types in default factories', <T extends
  string | number>() => {
  const props = withDefaults(
    defineProps<{
      value: T
      enabled?: boolean
      label?: string
      options?: readonly T[]
    }>(),
    {
      options: raw => {
        expectType<T>(raw.value)
        expectType<boolean | undefined>(raw.enabled)
        // @ts-expect-error defaults receive raw props before Boolean casting
        expectType<boolean>(raw.enabled)
        return [raw.value]
      },
    },
  )

  expectType<readonly T[]>(props.options)
  expectType<boolean>(props.enabled)
  expectType<string | undefined>(props.label)
})

describe('withDefaults accepts explicit Boolean keys', () => {
  type Props = { enabled?: boolean; label?: string }
  const props = withDefaults<
    Props,
    'enabled',
    { enabled: undefined; label: string }
  >(defineProps<Props>(), { enabled: undefined, label: 'Choose an option' })

  expectType<boolean | undefined>(props.enabled)
  // @ts-expect-error the explicit undefined default remains visible
  expectType<boolean>(props.enabled)
  expectType<string>(props.label)
})

describe('withDefaults rejects defaults of the wrong type', () => {
  // @ts-expect-error the default must match the declared prop type
  withDefaults(defineProps<{ label?: string }>(), { label: 42 })
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

describe('defineProps w/ runtime declaration + generic PropType', <T extends
  Record<string, any>>() => {
  // #9546
  const props = defineProps({
    foo: {
      type: Object as PropType<T>,
      required: false,
      default: null,
    },
    bar: {
      type: Object as PropType<T>,
      required: true,
    },
    baz: Object as PropType<T>,
    qux: String,
  })
  expectType<'foo' | 'bar' | 'baz' | 'qux'>(null! as keyof typeof props)
  expectType<T | null>(props.foo)
  expectType<T>(props.bar)
  expectType<T | undefined>(props.baz)
  expectType<string | undefined>(props.qux)

  // @ts-expect-error should not be a string
  expectType<string>(props.foo)
  // @ts-expect-error should not be a string
  expectType<string>(props.bar)
  // @ts-expect-error should not be a string
  expectType<string>(props.baz)

  // #9277: props should be usable where `T` is expected
  const use = (p: { bar: T }) => p
  use(props)
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

  const inferredNamedArrayDefault = defineModel('items', {
    type: Array as PropType<string[]>,
    default: () => [],
  })
  expectType<Ref<string[]>>(inferredNamedArrayDefault)

  const inferredArrayDefault = defineModel({
    type: Array as PropType<string[]>,
    default: () => [],
  })
  expectType<Ref<string[]>>(inferredArrayDefault)

  const arrayDefault = defineModel<number[]>({ default: () => [] })
  expectType<Ref<number[]>>(arrayDefault)

  const objectDefault = defineModel<{ foo: string }>({
    default: () => ({ foo: 'bar' }),
  })
  expectType<Ref<{ foo: string }>>(objectDefault)

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
  // @ts-expect-error runtime type / default mismatch
  defineModel('items', {
    type: Array as PropType<string[]>,
    default: () => [1],
  })
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
