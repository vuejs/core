import {
  type Component,
  type ComponentData,
  type ComponentProps,
  type ComponentPublicInstance,
  type ExtractComponentEmitOptions,
  type ExtractComponentSlotOptions,
  type FunctionalComponent,
  type PropType,
  type Ref,
  type SetupContext,
  defineComponent,
  ref,
  toRefs,
} from 'vue'
import { type IsAny, describe, expectAssignable, expectType } from './utils'
import type { EmitsToProps } from 'packages/runtime-core/src/componentEmits'

declare function extractComponentOptions<T>(obj: T): {
  props: ComponentProps<T>
  emits: ExtractComponentEmitOptions<T>
  slots: ExtractComponentSlotOptions<T>

  data: ComponentData<T>
  // rawBindings: RawBindings
  // setup: ShallowUnwrapRef<RawBindings>
}

declare function extractComponentProps<T>(obj: T): ComponentProps<T>

describe('object props', () => {
  interface ExpectedProps {
    a?: number | undefined
    b: string
    e?: Function
    bb: string
    bbb: string
    cc?: string[] | undefined
    dd: { n: 1 }
    ee?: () => string
    ff?: (a: number, b: string) => { a: boolean }
    ccc?: string[] | undefined
    ddd: string[]
    eee: () => { a: string }
    fff: (a: number, b: string) => { a: boolean }
    hhh: boolean
    ggg: 'foo' | 'bar'
    ffff: (a: number, b: string) => { a: boolean }
    validated?: string
    object?: object
  }

  interface ExpectedRefs {
    a: Ref<number | undefined>
    b: Ref<string>
    e: Ref<Function | undefined>
    bb: Ref<string>
    bbb: Ref<string>
    cc: Ref<string[] | undefined>
    dd: Ref<{ n: 1 }>
    ee: Ref<(() => string) | undefined>
    ff: Ref<((a: number, b: string) => { a: boolean }) | undefined>
    ccc: Ref<string[] | undefined>
    ddd: Ref<string[]>
    eee: Ref<() => { a: string }>
    fff: Ref<(a: number, b: string) => { a: boolean }>
    hhh: Ref<boolean>
    ggg: Ref<'foo' | 'bar'>
    ffff: Ref<(a: number, b: string) => { a: boolean }>
    validated: Ref<string | undefined>
    object: Ref<object | undefined>
    zzz: any
  }

  describe('defineComponent', () => {
    const MyComponent = defineComponent({
      props: {
        a: Number,
        // required should make property non-void
        b: {
          type: String,
          required: true,
        },
        e: Function,
        // default value should infer type and make it non-void
        bb: {
          default: 'hello',
        },
        bbb: {
          // Note: default function value requires arrow syntax + explicit
          // annotation
          default: (props: any) => (props.bb as string) || 'foo',
        },
        // explicit type casting
        cc: Array as PropType<string[]>,
        // required + type casting
        dd: {
          type: Object as PropType<{ n: 1 }>,
          required: true,
        },
        // return type
        ee: Function as PropType<() => string>,
        // arguments + object return
        ff: Function as PropType<(a: number, b: string) => { a: boolean }>,
        // explicit type casting with constructor
        ccc: Array as () => string[],
        // required + constructor type casting
        ddd: {
          type: Array as () => string[],
          required: true,
        },
        // required + object return
        eee: {
          type: Function as PropType<() => { a: string }>,
          required: true,
        },
        // required + arguments + object return
        fff: {
          type: Function as PropType<(a: number, b: string) => { a: boolean }>,
          required: true,
        },
        hhh: {
          type: Boolean,
          required: true,
        },
        // default + type casting
        ggg: {
          type: String as PropType<'foo' | 'bar'>,
          default: 'foo',
        },
        // default + function
        ffff: {
          type: Function as PropType<(a: number, b: string) => { a: boolean }>,
          default: (_a: number, _b: string) => ({ a: true }),
        },
        validated: {
          type: String,
          // validator requires explicit annotation
          validator: (val: unknown) => val !== '',
        },
        object: Object as PropType<object>,
        zzz: Object as PropType<any>,
      },
      setup(props) {
        const refs = toRefs(props)
        expectType<ExpectedRefs['a']>(refs.a)
        expectType<ExpectedRefs['b']>(refs.b)
        expectType<ExpectedRefs['e']>(refs.e)
        expectType<ExpectedRefs['bb']>(refs.bb)
        expectType<ExpectedRefs['bbb']>(refs.bbb)
        expectType<ExpectedRefs['cc']>(refs.cc)
        expectType<ExpectedRefs['dd']>(refs.dd)
        expectType<ExpectedRefs['ee']>(refs.ee)
        expectType<ExpectedRefs['ff']>(refs.ff)
        expectType<ExpectedRefs['ccc']>(refs.ccc)
        expectType<ExpectedRefs['ddd']>(refs.ddd)
        expectType<ExpectedRefs['eee']>(refs.eee)
        expectType<ExpectedRefs['fff']>(refs.fff)
        expectType<ExpectedRefs['hhh']>(refs.hhh)
        expectType<ExpectedRefs['ggg']>(refs.ggg)
        expectType<ExpectedRefs['ffff']>(refs.ffff)
        expectType<ExpectedRefs['validated']>(refs.validated)
        expectType<ExpectedRefs['object']>(refs.object)
        expectType<IsAny<typeof props.zzz>>(true)

        // @ts-expect-error should not be any
        expectType<string>(props)

        return {
          setupA: 1,
          setupB: ref(1),
          setupC: {
            a: ref(2),
          },
          setupD: undefined as Ref<number> | undefined,
          setupProps: props,
        }
      },
    })

    const { data } = extractComponentOptions(MyComponent)

    const props = extractComponentProps(MyComponent)

    // props
    expectType<ExpectedProps['a']>(props.a)
    expectType<ExpectedProps['b']>(props.b)
    expectType<ExpectedProps['e']>(props.e)
    expectType<ExpectedProps['bb']>(props.bb)
    expectType<ExpectedProps['bbb']>(props.bbb)
    expectType<ExpectedProps['cc']>(props.cc)
    expectType<ExpectedProps['dd']>(props.dd)
    expectType<ExpectedProps['ee']>(props.ee)
    expectType<ExpectedProps['ff']>(props.ff)
    expectType<ExpectedProps['ccc']>(props.ccc)
    expectType<ExpectedProps['ddd']>(props.ddd)
    expectType<ExpectedProps['eee']>(props.eee)
    expectType<ExpectedProps['fff']>(props.fff)
    expectType<ExpectedProps['hhh']>(props.hhh)
    expectType<ExpectedProps['ggg']>(props.ggg)
    expectType<ExpectedProps['ffff']>(props.ffff)
    expectType<ExpectedProps['validated']>(props.validated)
    expectType<ExpectedProps['object']>(props.object)

    // // raw bindings
    // expectType<Number>(rawBindings.setupA)
    // expectType<Ref<Number>>(rawBindings.setupB)
    // expectType<Ref<Number>>(rawBindings.setupC.a)
    // expectType<Ref<Number> | undefined>(rawBindings.setupD)

    // // raw bindings props
    // expectType<ExpectedProps['a']>(rawBindings.setupProps.a)
    // expectType<ExpectedProps['b']>(rawBindings.setupProps.b)
    // expectType<ExpectedProps['e']>(rawBindings.setupProps.e)
    // expectType<ExpectedProps['bb']>(rawBindings.setupProps.bb)
    // expectType<ExpectedProps['bbb']>(rawBindings.setupProps.bbb)
    // expectType<ExpectedProps['cc']>(rawBindings.setupProps.cc)
    // expectType<ExpectedProps['dd']>(rawBindings.setupProps.dd)
    // expectType<ExpectedProps['ee']>(rawBindings.setupProps.ee)
    // expectType<ExpectedProps['ff']>(rawBindings.setupProps.ff)
    // expectType<ExpectedProps['ccc']>(rawBindings.setupProps.ccc)
    // expectType<ExpectedProps['ddd']>(rawBindings.setupProps.ddd)
    // expectType<ExpectedProps['eee']>(rawBindings.setupProps.eee)
    // expectType<ExpectedProps['fff']>(rawBindings.setupProps.fff)
    // expectType<ExpectedProps['hhh']>(rawBindings.setupProps.hhh)
    // expectType<ExpectedProps['ggg']>(rawBindings.setupProps.ggg)
    // expectType<ExpectedProps['ffff']>(rawBindings.setupProps.ffff)
    // expectType<ExpectedProps['validated']>(rawBindings.setupProps.validated)

    // setup
    expectType<number>(data.setupA)
    expectType<number>(data.setupB)
    expectType<Ref<number>>(data.setupC.a)
    expectType<number | undefined>(data.setupD)

    // raw bindings props
    expectType<ExpectedProps['a']>(data.setupProps.a)
    expectType<ExpectedProps['b']>(data.setupProps.b)
    expectType<ExpectedProps['e']>(data.setupProps.e)
    expectType<ExpectedProps['bb']>(data.setupProps.bb)
    expectType<ExpectedProps['bbb']>(data.setupProps.bbb)
    expectType<ExpectedProps['cc']>(data.setupProps.cc)
    expectType<ExpectedProps['dd']>(data.setupProps.dd)
    expectType<ExpectedProps['ee']>(data.setupProps.ee)
    expectType<ExpectedProps['ff']>(data.setupProps.ff)
    expectType<ExpectedProps['ccc']>(data.setupProps.ccc)
    expectType<ExpectedProps['ddd']>(data.setupProps.ddd)
    expectType<ExpectedProps['eee']>(data.setupProps.eee)
    expectType<ExpectedProps['fff']>(data.setupProps.fff)
    expectType<ExpectedProps['hhh']>(data.setupProps.hhh)
    expectType<ExpectedProps['ggg']>(data.setupProps.ggg)
    expectType<ExpectedProps['ffff']>(data.setupProps.ffff)
    expectType<ExpectedProps['validated']>(data.setupProps.validated)

    // instance
    const instance = new MyComponent()
    expectType<number>(instance.setupA)
    expectType<number | undefined>(instance.setupD)
    // @ts-expect-error
    instance.notExist
  })

  describe('options', () => {
    const MyComponent = {
      props: {
        a: Number,
        // required should make property non-void
        b: {
          type: String,
          required: true,
        },
        e: Function,
        // default value should infer type and make it non-void
        bb: {
          default: 'hello',
        },
        bbb: {
          // Note: default function value requires arrow syntax + explicit
          // annotation
          default: (props: any) => (props.bb as string) || 'foo',
        },
        // explicit type casting
        cc: Array as PropType<string[]>,
        // required + type casting
        dd: {
          type: Object as PropType<{ n: 1 }>,
          required: true,
        },
        // return type
        ee: Function as PropType<() => string>,
        // arguments + object return
        ff: Function as PropType<(a: number, b: string) => { a: boolean }>,
        // explicit type casting with constructor
        ccc: Array as () => string[],
        // required + constructor type casting
        ddd: {
          type: Array as () => string[],
          required: true,
        },
        // required + object return
        eee: {
          type: Function as PropType<() => { a: string }>,
          required: true,
        },
        // required + arguments + object return
        fff: {
          type: Function as PropType<(a: number, b: string) => { a: boolean }>,
          required: true,
        },
        hhh: {
          type: Boolean,
          required: true,
        },
        // default + type casting
        ggg: {
          type: String as PropType<'foo' | 'bar'>,
          default: 'foo',
        },
        // default + function
        ffff: {
          type: Function as PropType<(a: number, b: string) => { a: boolean }>,
          default: (_a: number, _b: string) => ({ a: true }),
        },
        validated: {
          type: String,
          // validator requires explicit annotation
          validator: (val: unknown) => val !== '',
        },
        object: Object as PropType<object>,
      },

      setup() {
        return {
          setupA: 1,
        }
      },
    } as const

    const { data } = extractComponentOptions(MyComponent)

    const props = extractComponentProps(MyComponent)
    // props
    expectType<ExpectedProps['a']>(props.a)
    expectType<ExpectedProps['b']>(props.b)
    expectType<ExpectedProps['e']>(props.e)
    expectType<ExpectedProps['bb']>(props.bb)
    expectType<ExpectedProps['bbb']>(props.bbb)
    expectType<ExpectedProps['cc']>(props.cc)
    expectType<ExpectedProps['dd']>(props.dd)
    expectType<ExpectedProps['ee']>(props.ee)
    expectType<ExpectedProps['ff']>(props.ff)
    expectType<ExpectedProps['ccc']>(props.ccc)
    expectType<ExpectedProps['ddd']>(props.ddd)
    expectType<ExpectedProps['eee']>(props.eee)
    expectType<ExpectedProps['fff']>(props.fff)
    expectType<ExpectedProps['hhh']>(props.hhh)
    expectType<ExpectedProps['ggg']>(props.ggg)
    expectType<ExpectedProps['ffff']>(props.ffff)
    expectType<ExpectedProps['validated']>(props.validated)
    expectType<ExpectedProps['object']>(props.object)

    // data
    expectType<number>(data.setupA)
    // @ts-expect-error not any
    expectType<string>(data.setupA)
  })
})

describe('array props', () => {
  describe('defineComponent', () => {
    const MyComponent = defineComponent({
      props: ['a', 'b'],
      setup() {
        return {
          c: 1,
        }
      },
    })

    const { props, data } = extractComponentOptions(MyComponent)

    // @ts-expect-error props should be readonly
    props.a = 1
    expectType<any>(props.a)
    expectType<any>(props.b)

    expectType<number>(data.c)
  })

  describe('options', () => {
    const MyComponent = {
      props: ['a', 'b'] as const,
      setup() {
        return {
          c: 1,
        }
      },
    }

    const { data } = extractComponentOptions(MyComponent)

    const props = extractComponentProps(MyComponent)

    // @ts-expect-error props should be readonly
    props.a = 1

    expectType<any>(props.a)
    expectType<any>(props.b)

    expectType<number>(data.c)
  })
})

describe('no props', () => {
  describe('defineComponent', () => {
    const MyComponent = defineComponent({
      setup() {
        return {
          setupA: 1,
        }
      },
    })

    const { data } = extractComponentOptions(MyComponent)

    expectType<number>(data.setupA)

    // instance
    const instance = new MyComponent()
    expectType<number>(instance.setupA)
    // @ts-expect-error
    instance.notExist
  })

  describe('options', () => {
    const MyComponent = {
      setup() {
        return {
          setupA: 1,
        }
      },
    }

    const { data } = extractComponentOptions(MyComponent)

    expectType<number>(data.setupA)
  })
})

describe('functional', () => {
  describe('defineComponent', () => {
    const MyComponent = defineComponent((props: { foo: number }) => () => {})

    const { props } = extractComponentOptions(MyComponent)

    expectType<number>(props.foo)
  })

  describe('function', () => {
    const MyComponent = (props: { foo: number }) => props.foo
    const { props } = extractComponentOptions(MyComponent)

    expectType<number>(props.foo)
  })

  describe('typed', () => {
    type Props = { foo: number }
    type Emits = { change: [value: string]; inc: [value: number] }
    type Slots = { default: (scope: { foo: string }) => any }

    const MyComponent: FunctionalComponent<Props, Emits, Slots> = (
      props,
      { emit, slots },
    ) => {
      expectType<Props>(props)
      expectType<{
        (event: 'change', value: string): void
        (event: 'inc', value: number): void
      }>(emit)
      expectType<Slots>(slots)
    }

    const { props, emits, slots } = extractComponentOptions(MyComponent)

    expectType<Props>(props)
    // should contain emits
    expectType<EmitsToProps<Emits>>(props)
    //@ts-expect-error cannot be any
    expectType<boolean>(props)
    expectType<Emits>(emits)
    expectType<Slots>(slots)
  })
})

declare type VueClass<Props = {}> = {
  new (): ComponentPublicInstance<Props>
}

describe('class', () => {
  const MyComponent: VueClass<{ foo: number }> = {} as any

  const { props } = extractComponentOptions(MyComponent)

  expectType<number>(props.foo)
})

describe('SetupContext', () => {
  describe('can assign', () => {
    const wider: SetupContext<{ a: () => true; b: () => true }> = {} as any

    expectAssignable<SetupContext<{ b: () => true }>>(wider)
  })

  describe('short emits', () => {
    const {
      emit,
    }: SetupContext<{
      a: [val: string]
      b: [val: number]
    }> = {} as any

    expectType<{
      (event: 'a', val: string): void
      (event: 'b', val: number): void
    }>(emit)
  })
})
