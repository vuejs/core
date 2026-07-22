import {
  type Component,
  type ComponentPublicInstance,
  type EmitsOptions,
  type FunctionalComponent,
  type PropType,
  type Ref,
  type SetupContext,
  type ShallowUnwrapRef,
  defineComponent,
  ref,
  toRefs,
} from 'vue'
import { describe, expectAssignable, expectType } from './utils'

declare function extractComponentOptions<
  Props,
  RawBindings,
  Emits extends EmitsOptions | Record<string, any[]>,
  Slots extends Record<string, any>,
>(
  obj: Component<Props, RawBindings, any, any, any, Emits, Slots>,
): {
  props: Props
  emits: Emits
  slots: Slots
  rawBindings: RawBindings
  setup: ShallowUnwrapRef<RawBindings>
}

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
        expectType(refs.a, {} as ExpectedRefs['a'])
        expectType(refs.b, {} as ExpectedRefs['b'])
        expectType(refs.e, {} as ExpectedRefs['e'])
        expectType(refs.bb, {} as ExpectedRefs['bb'])
        expectType(refs.bbb, {} as ExpectedRefs['bbb'])
        expectType(refs.cc, {} as ExpectedRefs['cc'])
        expectType(refs.dd, {} as ExpectedRefs['dd'])
        expectType(refs.ee, {} as ExpectedRefs['ee'])
        expectType(refs.ff, {} as ExpectedRefs['ff'])
        expectType(refs.ccc, {} as ExpectedRefs['ccc'])
        expectType(refs.ddd, {} as ExpectedRefs['ddd'])
        expectType(refs.eee, {} as ExpectedRefs['eee'])
        expectType(refs.fff, {} as ExpectedRefs['fff'])
        expectType(refs.hhh, {} as ExpectedRefs['hhh'])
        expectType(refs.ggg, {} as ExpectedRefs['ggg'])
        expectType(refs.ffff, {} as ExpectedRefs['ffff'])
        expectType(refs.validated, {} as ExpectedRefs['validated'])
        expectType(refs.object, {} as ExpectedRefs['object'])
        expectType(props.zzz, {} as any)

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

    const { props, rawBindings, setup } = extractComponentOptions(MyComponent)

    // props
    expectType(props.a, {} as ExpectedProps['a'])
    expectType(props.b, {} as ExpectedProps['b'])
    expectType(props.e, {} as ExpectedProps['e'])
    expectType(props.bb, {} as ExpectedProps['bb'])
    expectType(props.bbb, {} as ExpectedProps['bbb'])
    expectType(props.cc, {} as ExpectedProps['cc'])
    expectType(props.dd, {} as ExpectedProps['dd'])
    expectType(props.ee, {} as ExpectedProps['ee'])
    expectType(props.ff, {} as ExpectedProps['ff'])
    expectType(props.ccc, {} as ExpectedProps['ccc'])
    expectType(props.ddd, {} as ExpectedProps['ddd'])
    expectType(props.eee, {} as ExpectedProps['eee'])
    expectType(props.fff, {} as ExpectedProps['fff'])
    expectType(props.hhh, {} as ExpectedProps['hhh'])
    expectType(props.ggg, {} as ExpectedProps['ggg'])
    expectType(props.ffff, {} as ExpectedProps['ffff'])
    expectType(props.validated, {} as ExpectedProps['validated'])
    expectType(props.object, {} as ExpectedProps['object'])

    // raw bindings
    expectType(rawBindings.setupA, {} as number)
    expectType(rawBindings.setupB, {} as Ref<number>)
    expectType(rawBindings.setupC.a, {} as Ref<number>)
    expectType(rawBindings.setupD, {} as Ref<number> | undefined)

    // raw bindings props
    expectType(rawBindings.setupProps.a, {} as ExpectedProps['a'])
    expectType(rawBindings.setupProps.b, {} as ExpectedProps['b'])
    expectType(rawBindings.setupProps.e, {} as ExpectedProps['e'])
    expectType(rawBindings.setupProps.bb, {} as ExpectedProps['bb'])
    expectType(rawBindings.setupProps.bbb, {} as ExpectedProps['bbb'])
    expectType(rawBindings.setupProps.cc, {} as ExpectedProps['cc'])
    expectType(rawBindings.setupProps.dd, {} as ExpectedProps['dd'])
    expectType(rawBindings.setupProps.ee, {} as ExpectedProps['ee'])
    expectType(rawBindings.setupProps.ff, {} as ExpectedProps['ff'])
    expectType(rawBindings.setupProps.ccc, {} as ExpectedProps['ccc'])
    expectType(rawBindings.setupProps.ddd, {} as ExpectedProps['ddd'])
    expectType(rawBindings.setupProps.eee, {} as ExpectedProps['eee'])
    expectType(rawBindings.setupProps.fff, {} as ExpectedProps['fff'])
    expectType(rawBindings.setupProps.hhh, {} as ExpectedProps['hhh'])
    expectType(rawBindings.setupProps.ggg, {} as ExpectedProps['ggg'])
    expectType(rawBindings.setupProps.ffff, {} as ExpectedProps['ffff'])
    expectType(
      rawBindings.setupProps.validated,
      {} as ExpectedProps['validated'],
    )

    // setup
    expectType(setup.setupA, {} as number)
    expectType(setup.setupB, {} as number)
    expectType(setup.setupC.a, {} as Ref<number>)
    expectType(setup.setupD, {} as number | undefined)

    // raw bindings props
    expectType(setup.setupProps.a, {} as ExpectedProps['a'])
    expectType(setup.setupProps.b, {} as ExpectedProps['b'])
    expectType(setup.setupProps.e, {} as ExpectedProps['e'])
    expectType(setup.setupProps.bb, {} as ExpectedProps['bb'])
    expectType(setup.setupProps.bbb, {} as ExpectedProps['bbb'])
    expectType(setup.setupProps.cc, {} as ExpectedProps['cc'])
    expectType(setup.setupProps.dd, {} as ExpectedProps['dd'])
    expectType(setup.setupProps.ee, {} as ExpectedProps['ee'])
    expectType(setup.setupProps.ff, {} as ExpectedProps['ff'])
    expectType(setup.setupProps.ccc, {} as ExpectedProps['ccc'])
    expectType(setup.setupProps.ddd, {} as ExpectedProps['ddd'])
    expectType(setup.setupProps.eee, {} as ExpectedProps['eee'])
    expectType(setup.setupProps.fff, {} as ExpectedProps['fff'])
    expectType(setup.setupProps.hhh, {} as ExpectedProps['hhh'])
    expectType(setup.setupProps.ggg, {} as ExpectedProps['ggg'])
    expectType(setup.setupProps.ffff, {} as ExpectedProps['ffff'])
    expectType(setup.setupProps.validated, {} as ExpectedProps['validated'])

    // instance
    const instance = new MyComponent()
    expectType(instance.setupA, {} as number)
    expectType(instance.setupD, {} as number | undefined)
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

    const { props, rawBindings, setup } = extractComponentOptions(MyComponent)

    // props
    expectAssignable<ExpectedProps['a']>(props.a)
    expectType(props.b, {} as ExpectedProps['b'])
    expectAssignable<ExpectedProps['e']>(props.e)
    expectAssignable<ExpectedProps['bb']>(props.bb)
    expectType(props.bbb, {} as ExpectedProps['bbb'])
    expectAssignable<ExpectedProps['cc']>(props.cc)
    expectType(props.dd, {} as ExpectedProps['dd'])
    expectAssignable<ExpectedProps['ee']>(props.ee)
    expectAssignable<ExpectedProps['ff']>(props.ff)
    expectAssignable<ExpectedProps['ccc']>(props.ccc)
    expectType(props.ddd, {} as ExpectedProps['ddd'])
    expectType(props.eee, {} as ExpectedProps['eee'])
    expectType(props.fff, {} as ExpectedProps['fff'])
    expectType(props.hhh, {} as ExpectedProps['hhh'])
    expectType(props.ggg, {} as ExpectedProps['ggg'])
    // expectType<ExpectedProps['ffff']>(props.ffff) // todo fix
    expectAssignable<ExpectedProps['validated']>(props.validated)
    expectAssignable<ExpectedProps['object']>(props.object)

    // rawBindings
    expectType(rawBindings.setupA, {} as number)

    //setup
    expectType(setup.setupA, {} as number)
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

    const { props, rawBindings, setup } = extractComponentOptions(MyComponent)

    // @ts-expect-error props should be readonly
    props.a = 1
    expectType(props.a, {} as any)
    expectType(props.b, {} as any)

    expectType(rawBindings.c, {} as number)
    expectType(setup.c, {} as number)
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

    const { props, rawBindings, setup } = extractComponentOptions(MyComponent)

    // @ts-expect-error props should be readonly
    props.a = 1

    // TODO infer the correct keys
    // expectType<any>(props.a)
    // expectType<any>(props.b)

    expectType(rawBindings.c, {} as number)
    expectType(setup.c, {} as number)
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

    const { rawBindings, setup } = extractComponentOptions(MyComponent)

    expectType(rawBindings.setupA, {} as number)
    expectType(setup.setupA, {} as number)

    // instance
    const instance = new MyComponent()
    expectType(instance.setupA, {} as number)
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

    const { rawBindings, setup } = extractComponentOptions(MyComponent)

    expectType(rawBindings.setupA, {} as number)
    expectType(setup.setupA, {} as number)
  })
})

describe('functional', () => {
  // TODO `props.foo` is `number|undefined`
  //   describe('defineComponent', () => {
  //     const MyComponent = defineComponent((props: { foo: number }) => {})

  //     const { props } = extractComponentOptions(MyComponent)

  //     expectType<number>(props.foo)
  //   })

  describe('function', () => {
    const MyComponent = (props: { foo: number }) => props.foo
    const { props } = extractComponentOptions(MyComponent)

    expectType(props.foo, {} as number)
  })

  describe('typed', () => {
    type Props = { foo: number }
    type Emits = { change: [value: string]; inc: [value: number] }
    type Slots = { default: (scope: { foo: string }) => any }

    const MyComponent: FunctionalComponent<Props, Emits, Slots> = (
      props,
      { emit, slots },
    ) => {
      expectAssignable<Props>(props)
      expectAssignable<{
        (event: 'change', value: string): void
        (event: 'inc', value: number): void
      }>(emit)
      expectAssignable<Slots>(slots)
    }

    const { props, emits, slots } = extractComponentOptions(MyComponent)

    expectType(props, {} as Props)
    expectType(emits, {} as Emits)
    expectType(slots, {} as Slots)
  })
})

declare type VueClass<Props = {}> = {
  new (): ComponentPublicInstance<Props>
}

describe('class', () => {
  const MyComponent: VueClass<{ foo: number }> = {} as any

  const { props } = extractComponentOptions(MyComponent)

  expectType(props.foo, {} as number)
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

    expectAssignable<{
      (event: 'a', val: string): void
      (event: 'b', val: number): void
    }>(emit)
  })
})
