import {
  type Component,
  type ComponentOptions,
  type ComponentPublicInstance,
  type PropType,
  type SetupContext,
  type Slots,
  type SlotsType,
  type VNode,
  createApp,
  defineComponent,
  h,
  reactive,
  ref,
  withKeys,
  withModifiers,
} from 'vue'
import { describe, expectAssignable, expectType } from './utils'

describe('with object props', () => {
  interface ExpectedProps {
    a?: number | undefined
    aa: number
    aaa: number | null
    aaaa: number | undefined
    b: string
    e?: Function
    h: boolean
    j: undefined | (() => string | undefined)
    bb: string
    bbb: string
    bbbb: string | undefined
    bbbbb: string | undefined
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
    iii?: (() => string) | (() => number)
    jjj: ((arg1: string) => string) | ((arg1: string, arg2: string) => string)
    kkk?: any
    validated?: string
    date?: Date
    l?: Date
    ll?: Date | number
    lll?: string | number
  }

  type GT = string & { __brand: unknown }

  const props = {
    a: Number,
    aa: {
      type: Number as PropType<number | undefined>,
      default: 1,
    },
    aaa: {
      type: Number as PropType<number | null>,
      default: 1,
    },
    aaaa: {
      type: Number as PropType<number | undefined>,
      // `as const` prevents widening to `boolean` (keeps literal `true` type)
      required: true as const,
    },
    // required should make property non-void
    b: {
      type: String,
      required: true as true,
    },
    e: Function,
    h: Boolean,
    j: Function as PropType<undefined | (() => string | undefined)>,
    // default value should infer type and make it non-void
    bb: {
      default: 'hello',
    },
    bbb: {
      // Note: default function value requires arrow syntax + explicit
      // annotation
      default: (props: any) => (props.bb as string) || 'foo',
    },
    bbbb: {
      type: String,
      default: undefined,
    },
    bbbbb: {
      type: String,
      default: () => undefined,
    },
    // explicit type casting
    cc: Array as PropType<string[]>,
    // required + type casting
    dd: {
      type: Object as PropType<{ n: 1 }>,
      required: true as true,
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
      required: true as true,
    },
    // required + object return
    eee: {
      type: Function as PropType<() => { a: string }>,
      required: true as true,
    },
    // required + arguments + object return
    fff: {
      type: Function as PropType<(a: number, b: string) => { a: boolean }>,
      required: true as true,
    },
    hhh: {
      type: Boolean,
      required: true as true,
    },
    // default + type casting
    ggg: {
      type: String as PropType<'foo' | 'bar'>,
      default: 'foo',
    },
    // default + function
    ffff: {
      type: Function as PropType<(a: number, b: string) => { a: boolean }>,
      default: (a: number, b: string) => ({ a: a > +b }),
    },
    // union + function with different return types
    iii: Function as PropType<(() => string) | (() => number)>,
    // union + function with different args & same return type
    jjj: {
      type: Function as PropType<
        ((arg1: string) => string) | ((arg1: string, arg2: string) => string)
      >,
      required: true as true,
    },
    kkk: null,
    validated: {
      type: String,
      // validator requires explicit annotation
      validator: (val: unknown) => val !== '',
    },
    date: Date,
    l: [Date],
    ll: [Date, Number],
    lll: [String, Number],
  }

  const MyComponent = defineComponent({
    props,
    setup(props) {
      // type assertion. See https://github.com/SamVerschueren/tsd
      expectType(props.a, {} as ExpectedProps['a'])
      expectType(props.aa, {} as ExpectedProps['aa'])
      expectType(props.aaa, {} as ExpectedProps['aaa'])
      expectType(props.aaaa, {} as ExpectedProps['aaaa'])

      expectType(props.b, {} as ExpectedProps['b'])
      expectType(props.e, {} as ExpectedProps['e'])
      expectType(props.h, {} as ExpectedProps['h'])
      expectType(props.j, {} as ExpectedProps['j'])
      expectType(props.bb, {} as ExpectedProps['bb'])
      expectType(props.bbb, {} as ExpectedProps['bbb'])
      expectType(props.bbbb, {} as ExpectedProps['bbbb'])
      expectType(props.bbbbb, {} as ExpectedProps['bbbbb'])
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
      if (typeof props.iii !== 'function') {
        expectType(props.iii, {} as unknown as undefined)
      }
      expectType(props.iii, {} as ExpectedProps['iii'])
      expectType(props.jjj, {} as ExpectedProps['jjj'])
      expectType(props.kkk, {} as ExpectedProps['kkk'])
      expectType(props.validated, {} as ExpectedProps['validated'])
      expectType(props.date, {} as ExpectedProps['date'])
      expectType(props.l, {} as ExpectedProps['l'])
      expectType(props.ll, {} as ExpectedProps['ll'])
      expectType(props.lll, {} as ExpectedProps['lll'])

      // @ts-expect-error props should be readonly
      props.a = 1

      // setup context
      return {
        c: ref(1),
        d: {
          e: ref('hi'),
        },
        f: reactive({
          g: ref('hello' as GT),
        }),
      }
    },
    provide() {
      return {}
    },
    render() {
      const props = this.$props
      expectType(props.a, {} as ExpectedProps['a'])
      expectType(props.aa, {} as ExpectedProps['aa'])
      expectType(props.aaa, {} as ExpectedProps['aaa'])
      expectType(props.b, {} as ExpectedProps['b'])
      expectType(props.e, {} as ExpectedProps['e'])
      expectType(props.h, {} as ExpectedProps['h'])
      expectType(props.bb, {} as ExpectedProps['bb'])
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
      if (typeof props.iii !== 'function') {
        expectType(props.iii, {} as unknown as undefined)
      }
      expectType(props.iii, {} as ExpectedProps['iii'])
      expectType(props.jjj, {} as ExpectedProps['jjj'])
      expectType(props.kkk, {} as ExpectedProps['kkk'])

      // @ts-expect-error props should be readonly
      props.a = 1

      // should also expose declared props on `this`
      expectType(this.a, {} as ExpectedProps['a'])
      expectType(this.aa, {} as ExpectedProps['aa'])
      expectType(this.aaa, {} as ExpectedProps['aaa'])
      expectType(this.b, {} as ExpectedProps['b'])
      expectType(this.e, {} as ExpectedProps['e'])
      expectType(this.h, {} as ExpectedProps['h'])
      expectType(this.bb, {} as ExpectedProps['bb'])
      expectType(this.cc, {} as ExpectedProps['cc'])
      expectType(this.dd, {} as ExpectedProps['dd'])
      expectType(this.ee, {} as ExpectedProps['ee'])
      expectType(this.ff, {} as ExpectedProps['ff'])
      expectType(this.ccc, {} as ExpectedProps['ccc'])
      expectType(this.ddd, {} as ExpectedProps['ddd'])
      expectType(this.eee, {} as ExpectedProps['eee'])
      expectType(this.fff, {} as ExpectedProps['fff'])
      expectType(this.hhh, {} as ExpectedProps['hhh'])
      expectType(this.ggg, {} as ExpectedProps['ggg'])
      if (typeof this.iii !== 'function') {
        expectType(this.iii, {} as unknown as undefined)
      }
      expectType(this.iii, {} as ExpectedProps['iii'])
      expectType(this.jjj, {} as ExpectedProps['jjj'])
      expectType(this.kkk, {} as ExpectedProps['kkk'])

      // @ts-expect-error props on `this` should be readonly
      this.a = 1

      // assert setup context unwrapping
      expectType(this.c, {} as number)
      expectType(this.d.e.value, {} as string)
      expectType(this.f.g, {} as GT)

      // setup context properties should be mutable
      this.c = 2

      return null
    },
  })

  expectAssignable<Component>(MyComponent)

  // Test TSX
  expectType(
    <MyComponent
      a={1}
      aaaa={1}
      b="b"
      bb="bb"
      e={() => {}}
      cc={['cc']}
      dd={{ n: 1 }}
      ee={() => 'ee'}
      ccc={['ccc']}
      ddd={['ddd']}
      eee={() => ({ a: 'eee' })}
      fff={(a, b) => ({ a: a > +b })}
      hhh={false}
      ggg="foo"
      jjj={() => ''}
      // should allow class/style as attrs
      class="bar"
      style={{ color: 'red' }}
      // should allow key
      key={'foo'}
      // should allow ref
      ref={'foo'}
      ref_for={true}
    />,
    {} as JSX.Element,
  )

  expectAssignable<Component>(
    <MyComponent
      aaaa={1}
      b="b"
      dd={{ n: 1 }}
      ddd={['ddd']}
      eee={() => ({ a: 'eee' })}
      fff={(a, b) => ({ a: a > +b })}
      hhh={false}
      jjj={() => ''}
    />,
  )

  // @ts-expect-error missing required props
  let c = <MyComponent />
  // @ts-expect-error wrong prop types
  c = <MyComponent a={'wrong type'} b="foo" dd={{ n: 1 }} ddd={['foo']} />
  // @ts-expect-error wrong prop types
  c = <MyComponent ggg="baz" />

  // @ts-expect-error
  ;<MyComponent b="foo" dd={{ n: 'string' }} ddd={['foo']} />

  // `this` should be void inside of prop validators and prop default factories
  defineComponent({
    props: {
      myProp: {
        type: Number,
        validator(val: unknown): boolean {
          // @ts-expect-error
          return val !== this.otherProp
        },
        default(): number {
          // @ts-expect-error
          return this.otherProp + 1
        },
      },
      otherProp: {
        type: Number,
        required: true,
      },
    },
  })
})

describe('type inference w/ optional props declaration', () => {
  const MyComponent = defineComponent<{ a: string[]; msg: string }>({
    setup(props) {
      expectType(props.msg, {} as string)
      expectType(props.a, {} as string[])
      return {
        b: 1,
      }
    },
  })

  expectType(<MyComponent msg="1" a={['1']} />, {} as JSX.Element)
  // @ts-expect-error
  ;<MyComponent />
  // @ts-expect-error
  ;<MyComponent msg="1" />
})

describe('type inference w/ direct setup function', () => {
  const MyComponent = defineComponent((_props: { msg: string }) => () => {})
  expectType(<MyComponent msg="foo" />, {} as JSX.Element)
  // @ts-expect-error
  ;<MyComponent />
  // @ts-expect-error
  ;<MyComponent msg={1} />
})

describe('type inference w/ array props declaration', () => {
  const MyComponent = defineComponent({
    props: ['a', 'b'],
    setup(props) {
      // @ts-expect-error props should be readonly
      props.a = 1
      expectType(props.a, {} as any)
      expectType(props.b, {} as any)
      return {
        c: 1,
      }
    },
    render() {
      expectType(this.$props.a, {} as any)
      expectType(this.$props.b, {} as any)
      // @ts-expect-error
      this.$props.a = 1
      expectType(this.a, {} as any)
      expectType(this.b, {} as any)
      expectType(this.c, {} as number)
    },
  })
  expectType(<MyComponent a={[1, 2]} b="b" />, {} as JSX.Element)
  // @ts-expect-error
  ;<MyComponent other="other" />
})

describe('type inference w/ options API', () => {
  defineComponent({
    props: { a: Number },
    setup() {
      return {
        b: 123,
      }
    },
    data() {
      // Limitation: we cannot expose the return result of setup() on `this`
      // here in data() - somehow that would mess up the inference
      expectType(this.a, {} as number | undefined)
      return {
        c: this.a || 123,
        someRef: ref(0),
      }
    },
    computed: {
      d() {
        expectType(this.b, {} as number)
        return this.b + 1
      },
      e: {
        get() {
          expectType(this.b, {} as number)
          expectType(this.d, {} as number)

          return this.b + this.d
        },
        set(v: number) {
          expectType(this.b, {} as number)
          expectType(this.d, {} as number)
          expectType(v, {} as number)
        },
      },
    },
    watch: {
      a() {
        expectType(this.b, {} as number)
        this.b + 1
      },
    },
    created() {
      // props
      expectType(this.a, {} as number | undefined)
      // returned from setup()
      expectType(this.b, {} as number)
      // returned from data()
      expectType(this.c, {} as number)
      // computed
      expectType(this.d, {} as number)
      // computed get/set
      expectType(this.e, {} as number)
      expectType(this.someRef, {} as number)
    },
    methods: {
      doSomething() {
        // props
        expectType(this.a, {} as number | undefined)
        // returned from setup()
        expectType(this.b, {} as number)
        // returned from data()
        expectType(this.c, {} as number)
        // computed
        expectType(this.d, {} as number)
        // computed get/set
        expectType(this.e, {} as number)
      },
      returnSomething() {
        return this.a
      },
    },
    render() {
      // props
      expectType(this.a, {} as number | undefined)
      // returned from setup()
      expectType(this.b, {} as number)
      // returned from data()
      expectType(this.c, {} as number)
      // computed
      expectType(this.d, {} as number)
      // computed get/set
      expectType(this.e, {} as number)
      // method
      expectType(this.returnSomething, {} as () => number | undefined)
    },
  })
})

// #4051
describe('type inference w/ empty prop object', () => {
  const MyComponent = defineComponent({
    props: {},
    setup(props) {
      return {}
    },
    render() {},
  })
  expectType(<MyComponent />, {} as JSX.Element)
  // AllowedComponentProps
  expectType(<MyComponent class={'foo'} />, {} as JSX.Element)
  // ComponentCustomProps
  expectType(<MyComponent custom={1} />, {} as JSX.Element)
  // VNodeProps
  expectType(<MyComponent key="1" />, {} as JSX.Element)
  // @ts-expect-error
  expectError(<MyComponent other="other" />)
})

describe('with mixins', () => {
  const MixinA = defineComponent({
    emits: ['bar'],
    props: {
      aP1: {
        type: String,
        default: 'aP1',
      },
      aP2: Boolean,
    },
    data() {
      return {
        a: 1,
      }
    },
  })
  const MixinB = defineComponent({
    props: ['bP1', 'bP2'],
    data() {
      return {
        b: 2,
      }
    },
  })
  const MixinC = defineComponent({
    data() {
      return {
        c: 3,
      }
    },
  })
  const MixinD = defineComponent({
    mixins: [MixinA],
    data() {
      //@ts-expect-error computed are not available on data()
      expectError<number>(this.dC1)
      //@ts-expect-error computed are not available on data()
      expectError<string>(this.dC2)

      return {
        d: 4,
      }
    },
    setup(props) {
      expectType(props.aP1, {} as string)
    },
    computed: {
      dC1() {
        return this.d + this.a
      },
      dC2() {
        return this.aP1 + 'dC2'
      },
    },
  })
  const MyComponent = defineComponent({
    mixins: [MixinA, MixinB, MixinC, MixinD],
    emits: ['click'],
    props: {
      // required should make property non-void
      z: {
        type: String,
        required: true,
      },
    },

    data(vm) {
      expectType(vm.a, {} as number)
      expectType(vm.b, {} as number)
      expectType(vm.c, {} as number)
      expectType(vm.d, {} as number)

      // should also expose declared props on `this`
      expectType(this.a, {} as number)
      expectType(this.aP1, {} as string)
      expectAssignable<boolean | undefined>(this.aP2)
      expectType(this.b, {} as number)
      expectType(this.bP1, {} as any)
      expectType(this.c, {} as number)
      expectType(this.d, {} as number)

      return {}
    },

    setup(props) {
      expectType(props.z, {} as string)
      // props
      expectType(props.onClick, {} as ((...args: any[]) => any) | undefined)
      // from MixinA
      expectType(props.onBar, {} as ((...args: any[]) => any) | undefined)
      expectType(props.aP1, {} as string)
      expectAssignable<boolean | undefined>(props.aP2)
      expectType(props.bP1, {} as any)
      expectType(props.bP2, {} as any)
      expectType(props.z, {} as string)
    },
    render() {
      const props = this.$props
      // props
      expectType(props.onClick, {} as ((...args: any[]) => any) | undefined)
      // from MixinA
      expectType(props.onBar, {} as ((...args: any[]) => any) | undefined)
      expectType(props.aP1, {} as string)
      expectAssignable<boolean | undefined>(props.aP2)
      expectType(props.bP1, {} as any)
      expectType(props.bP2, {} as any)
      expectType(props.z, {} as string)

      const data = this.$data
      expectType(data.a, {} as number)
      expectType(data.b, {} as number)
      expectType(data.c, {} as number)
      expectType(data.d, {} as number)

      // should also expose declared props on `this`
      expectType(this.a, {} as number)
      expectType(this.aP1, {} as string)
      expectAssignable<boolean | undefined>(this.aP2)
      expectType(this.b, {} as number)
      expectType(this.bP1, {} as any)
      expectType(this.c, {} as number)
      expectType(this.d, {} as number)
      expectType(this.dC1, {} as number)
      expectType(this.dC2, {} as string)

      // props should be readonly
      // @ts-expect-error
      this.aP1 = 'new'
      // @ts-expect-error
      this.z = 1

      // props on `this` should be readonly
      // @ts-expect-error
      this.bP1 = 1

      // string value can not assigned to number type value
      // @ts-expect-error
      this.c = '1'

      // setup context properties should be mutable
      this.d = 5

      return null
    },
  })

  // Test TSX
  expectType(
    <MyComponent aP1={'aP'} aP2 bP1={1} bP2={[1, 2]} z={'z'} />,
    {} as JSX.Element,
  )

  // missing required props
  // @ts-expect-error
  ;<MyComponent />

  // wrong prop types
  // @ts-expect-error
  ;<MyComponent aP1="ap" aP2={'wrong type'} bP1="b" z={'z'} />
  // @ts-expect-error
  ;<MyComponent aP1={1} bP2={[1]} />
})

describe('with extends', () => {
  const Base = defineComponent({
    props: {
      aP1: Boolean,
      aP2: {
        type: Number,
        default: 2,
      },
    },
    data() {
      return {
        a: 1,
      }
    },
    computed: {
      c(): number {
        return this.aP2 + this.a
      },
    },
  })
  const MyComponent = defineComponent({
    extends: Base,
    props: {
      // required should make property non-void
      z: {
        type: String,
        required: true,
      },
    },
    render() {
      const props = this.$props
      // props
      expectAssignable<boolean | undefined>(props.aP1)
      expectType(props.aP2, {} as number)
      expectType(props.z, {} as string)

      const data = this.$data
      expectType(data.a, {} as number)

      // should also expose declared props on `this`
      expectType(this.a, {} as number)
      expectAssignable<boolean | undefined>(this.aP1)
      expectType(this.aP2, {} as number)

      // setup context properties should be mutable
      this.a = 5

      return null
    },
  })

  // Test TSX
  expectType(<MyComponent aP2={3} aP1 z={'z'} />, {} as JSX.Element)

  // missing required props
  // @ts-expect-error
  ;<MyComponent />

  // wrong prop types
  // @ts-expect-error
  ;<MyComponent aP2={'wrong type'} z={'z'} />
  // @ts-expect-error
  ;<MyComponent aP1={3} />
})

describe('extends with mixins', () => {
  const Mixin = defineComponent({
    emits: ['bar'],
    props: {
      mP1: {
        type: String,
        default: 'mP1',
      },
      mP2: Boolean,
      mP3: {
        type: Boolean,
        required: true,
      },
    },
    data() {
      return {
        a: 1,
      }
    },
  })
  const Base = defineComponent({
    emits: ['foo'],
    props: {
      p1: Boolean,
      p2: {
        type: Number,
        default: 2,
      },
      p3: {
        type: Boolean,
        required: true,
      },
    },
    data() {
      return {
        b: 2,
      }
    },
    computed: {
      c(): number {
        return this.p2 + this.b
      },
    },
  })
  const MyComponent = defineComponent({
    extends: Base,
    mixins: [Mixin],
    emits: ['click'],
    props: {
      // required should make property non-void
      z: {
        type: String,
        required: true,
      },
    },
    render() {
      const props = this.$props
      // props
      expectType(props.onClick, {} as ((...args: any[]) => any) | undefined)
      // from Mixin
      expectType(props.onBar, {} as ((...args: any[]) => any) | undefined)
      // from Base
      expectType(props.onFoo, {} as ((...args: any[]) => any) | undefined)
      expectAssignable<boolean | undefined>(props.p1)
      expectType(props.p2, {} as number)
      expectType(props.z, {} as string)
      expectType(props.mP1, {} as string)
      expectAssignable<boolean | undefined>(props.mP2)

      const data = this.$data
      expectType(data.a, {} as number)
      expectType(data.b, {} as number)

      // should also expose declared props on `this`
      expectType(this.a, {} as number)
      expectType(this.b, {} as number)
      expectAssignable<boolean | undefined>(this.p1)
      expectType(this.p2, {} as number)
      expectType(this.mP1, {} as string)
      expectAssignable<boolean | undefined>(this.mP2)

      // setup context properties should be mutable
      this.a = 5

      return null
    },
  })

  // Test TSX
  expectType(
    <MyComponent mP1="p1" mP2 mP3 p1 p2={1} p3 z={'z'} />,
    {} as JSX.Element,
  )

  // mP1, mP2, p1, and p2 have default value. these are not required
  expectType(<MyComponent mP3 p3 z={'z'} />, {} as JSX.Element)

  // missing required props
  // @ts-expect-error
  ;<MyComponent mP3 p3 /* z='z' */ />
  // missing required props from mixin
  // @ts-expect-error
  ;<MyComponent /* mP3 */ p3 z="z" />
  // missing required props from extends
  // @ts-expect-error
  ;<MyComponent mP3 /* p3 */ z="z" />

  // wrong prop types
  // @ts-expect-error
  ;<MyComponent p2={'wrong type'} z={'z'} />
  // @ts-expect-error
  ;<MyComponent mP1={3} />

  // #3468
  const CompWithD = defineComponent({
    data() {
      return { foo: 1 }
    },
  })
  const CompWithC = defineComponent({
    computed: {
      foo() {
        return 1
      },
    },
  })
  const CompWithM = defineComponent({ methods: { foo() {} } })
  const CompEmpty = defineComponent({})

  defineComponent({
    mixins: [CompWithD, CompEmpty],
    mounted() {
      expectType(this.foo, {} as number)
    },
  })
  defineComponent({
    mixins: [CompWithC, CompEmpty],
    mounted() {
      expectAssignable<number>(this.foo)
    },
  })
  defineComponent({
    mixins: [CompWithM, CompEmpty],
    mounted() {
      expectType(this.foo, {} as () => void)
    },
  })
})

describe('compatibility w/ createApp', () => {
  const comp = defineComponent({})
  createApp(comp).mount('#hello')

  const comp2 = defineComponent({
    props: { foo: String },
  })
  createApp(comp2).mount('#hello')

  const comp3 = defineComponent({
    setup() {
      return {
        a: 1,
      }
    },
  })
  createApp(comp3).mount('#hello')
})

describe('defineComponent', () => {
  describe('should accept components defined with defineComponent', () => {
    const comp = defineComponent({})
    defineComponent({
      components: { comp },
    })
  })

  describe('should accept class components with receiving constructor arguments', () => {
    class Comp {
      static __vccOpts = {}
      constructor(_props: { foo: string }) {}
    }
    defineComponent({
      components: { Comp },
    })
  })
})

describe('emits', () => {
  // Note: for TSX inference, ideally we want to map emits to onXXX props,
  // but that requires type-level string constant concatenation as suggested in
  // https://github.com/Microsoft/TypeScript/issues/12754

  // The workaround for TSX users is instead of using emits, declare onXXX props
  // and call them instead. Since `v-on:click` compiles to an `onClick` prop,
  // this would also support other users consuming the component in templates
  // with `v-on` listeners.

  // with object emits
  defineComponent({
    emits: {
      click: (n: number) => typeof n === 'number',
      input: (b: string) => b.length > 1,
      Focus: (f: boolean) => !!f,
    },
    setup(props, { emit }) {
      expectAssignable<((n: number) => boolean) | undefined>(props.onClick)
      expectAssignable<((b: string) => boolean) | undefined>(props.onInput)
      expectAssignable<((f: boolean) => boolean) | undefined>(props.onFocus)
      emit('click', 1)
      emit('input', 'foo')
      emit('Focus', true)
      //  @ts-expect-error
      emit('nope')
      //  @ts-expect-error
      emit('click')
      //  @ts-expect-error
      emit('click', 'foo')
      //  @ts-expect-error
      emit('input')
      //  @ts-expect-error
      emit('input', 1)
      //  @ts-expect-error
      emit('focus')
      //  @ts-expect-error
      emit('focus', true)
    },
    created() {
      this.$emit('click', 1)
      this.$emit('input', 'foo')
      //  @ts-expect-error
      this.$emit('nope')
      //  @ts-expect-error
      this.$emit('click')
      //  @ts-expect-error
      this.$emit('click', 'foo')
      //  @ts-expect-error
      this.$emit('input')
      //  @ts-expect-error
      this.$emit('input', 1)
      //  @ts-expect-error
      this.$emit('focus')
      //  @ts-expect-error
      this.$emit('focus', true)
    },
    mounted() {
      // #3599
      this.$nextTick(function () {
        // this should be bound to this instance

        this.$emit('click', 1)
        this.$emit('input', 'foo')
        //  @ts-expect-error
        this.$emit('nope')
        //  @ts-expect-error
        this.$emit('click')
        //  @ts-expect-error
        this.$emit('click', 'foo')
        //  @ts-expect-error
        this.$emit('input')
        //  @ts-expect-error
        this.$emit('input', 1)
        //  @ts-expect-error
        this.$emit('focus')
        //  @ts-expect-error
        this.$emit('focus', true)
      })
    },
  })

  // with array emits
  defineComponent({
    emits: ['foo', 'bar'],
    setup(props, { emit }) {
      expectType(props.onFoo, {} as ((...args: any[]) => any) | undefined)
      expectType(props.onBar, {} as ((...args: any[]) => any) | undefined)
      emit('foo')
      emit('foo', 123)
      emit('bar')
      //  @ts-expect-error
      emit('nope')
    },
    created() {
      this.$emit('foo')
      this.$emit('foo', 123)
      this.$emit('bar')
      //  @ts-expect-error
      this.$emit('nope')
    },
  })

  // with tsx
  const Component = defineComponent({
    emits: {
      click: (n: number) => typeof n === 'number',
    },
    setup(props, { emit }) {
      expectType(props.onClick, {} as ((n: number) => any) | undefined)
      emit('click', 1)
      //  @ts-expect-error
      emit('click')
      //  @ts-expect-error
      emit('click', 'foo')
    },
  })

  defineComponent({
    render() {
      return (
        <Component
          onClick={(n: number) => {
            return n + 1
          }}
        />
      )
    },
  })

  // #11803 manual props annotation in setup()
  const Hello = defineComponent({
    name: 'HelloWorld',
    inheritAttrs: false,
    props: { foo: String },
    emits: {
      customClick: (args: string) => typeof args === 'string',
    },
    setup(props: { foo?: string }) {},
  })
  ;<Hello onCustomClick={() => {}} />

  // without emits
  defineComponent({
    setup(props, { emit }) {
      emit('test', 1)
      emit('test')
    },
  })

  // emit should be valid when ComponentPublicInstance is used.
  const instance = {} as ComponentPublicInstance
  instance.$emit('test', 1)
  instance.$emit('test')

  // `this` should be void inside of emits validators
  defineComponent({
    props: ['bar'],
    emits: {
      foo(): boolean {
        // @ts-expect-error
        return this.bar === 3
      },
    },
  })
})

describe('inject', () => {
  // with object inject
  defineComponent({
    props: {
      a: String,
    },
    inject: {
      foo: 'foo',
      bar: 'bar',
    },
    created() {
      expectType(this.foo, {} as unknown)
      expectType(this.bar, {} as unknown)
      //  @ts-expect-error
      this.foobar = 1
    },
  })

  // with array inject
  defineComponent({
    props: ['a', 'b'],
    inject: ['foo', 'bar'],
    created() {
      expectType(this.foo, {} as unknown)
      expectType(this.bar, {} as unknown)
      //  @ts-expect-error
      this.foobar = 1
    },
  })

  // with no props
  defineComponent({
    inject: {
      foo: {
        from: 'pfoo',
        default: 'foo',
      },
      bar: {
        from: 'pbar',
        default: 'bar',
      },
    },
    created() {
      expectType(this.foo, {} as unknown)
      expectType(this.bar, {} as unknown)
      //  @ts-expect-error
      this.foobar = 1
    },
  })

  // without inject
  defineComponent({
    props: ['a', 'b'],
    created() {
      //  @ts-expect-error
      this.foo = 1
      //  @ts-expect-error
      this.bar = 1
    },
  })
})

describe('componentOptions setup should be `SetupContext`', () => {
  expectAssignable<ComponentOptions['setup']>(
    {} as (props: Record<string, any>, ctx: SetupContext) => any,
  )
})

describe('extract instance type', () => {
  const Base = defineComponent({
    props: {
      baseA: {
        type: Number,
        default: 1,
      },
    },
  })
  const MixinA = defineComponent({
    props: {
      mA: {
        type: String,
        default: '',
      },
    },
  })
  const CompA = defineComponent({
    extends: Base,
    mixins: [MixinA],
    props: {
      a: {
        type: Boolean,
        default: false,
      },
      b: {
        type: String,
        required: true,
      },
      c: Number,
    },
  })

  const compA = {} as InstanceType<typeof CompA>

  expectType(compA.a, {} as boolean)
  expectType(compA.b, {} as string)
  expectType(compA.c, {} as number | undefined)
  // mixins
  expectType(compA.mA, {} as string)
  // extends
  expectType(compA.baseA, {} as number)

  //  @ts-expect-error
  compA.a = true
  //  @ts-expect-error
  compA.b = 'foo'
  //  @ts-expect-error
  compA.c = 1
  //  @ts-expect-error
  compA.mA = 'foo'
  //  @ts-expect-error
  compA.baseA = 1
})

describe('async setup', () => {
  type GT = string & { __brand: unknown }
  const Comp = defineComponent({
    async setup() {
      // setup context
      return {
        a: ref(1),
        b: {
          c: ref('hi'),
        },
        d: reactive({
          e: ref('hello' as GT),
        }),
      }
    },
    render() {
      // assert setup context unwrapping
      expectType(this.a, {} as number)
      expectType(this.b.c.value, {} as string)
      expectType(this.d.e, {} as GT)

      // setup context properties should be mutable
      this.a = 2
    },
  })

  const vm = {} as InstanceType<typeof Comp>
  // assert setup context unwrapping
  expectType(vm.a, {} as number)
  expectType(vm.b.c.value, {} as string)
  expectType(vm.d.e, {} as GT)

  // setup context properties should be mutable
  vm.a = 2
})

// #5948
describe('DefineComponent should infer correct types when assigning to Component', () => {
  let component: Component
  component = defineComponent({
    setup(_, { attrs, slots }) {
      expectType(attrs, {} as SetupContext['attrs'])
      expectType(slots, {} as SetupContext['slots'])
    },
  })
  expectAssignable<Component>(component)
})

// #5969
describe('should allow to assign props', () => {
  const Child = defineComponent({
    props: {
      bar: String,
    },
  })

  const Parent = defineComponent({
    props: {
      ...Child.props,
      foo: String,
    },
  })

  const child = new Child()
  expectType(<Parent {...child.$props} />, {} as JSX.Element)
})

// #6052
describe('prop starting with `on*` is broken', () => {
  defineComponent({
    props: {
      onX: {
        type: Function as PropType<(a: 1) => void>,
        required: true,
      },
    },
    setup(props) {
      expectType(props.onX, {} as (a: 1) => void)
      props.onX(1)
    },
  })

  defineComponent({
    props: {
      onX: {
        type: Function as PropType<(a: 1) => void>,
        required: true,
      },
    },
    emits: {
      test: (a: 1) => true,
    },
    setup(props) {
      expectType(props.onX, {} as (a: 1) => void)
      expectType(props.onTest, {} as undefined | ((a: 1) => any))
    },
  })
})

describe('function syntax w/ generics', () => {
  const Comp = defineComponent(
    // TODO: babel plugin to auto infer runtime props options from type
    // similar to defineProps<{...}>()
    <T extends string | number>(props: { msg: T; list: T[] }) => {
      // use Composition API here like in <script setup>
      const count = ref(0)

      return () => (
        // return a render function (both JSX and h() works)
        <div>
          {props.msg} {count.value}
        </div>
      )
    },
  )

  expectType(<Comp msg="fse" list={['foo']} />, {} as JSX.Element)
  expectType(<Comp msg={123} list={[123]} />, {} as JSX.Element)

  expectType(
    // @ts-expect-error missing prop
    <Comp msg={123} />,
    {} as JSX.Element,
  )

  expectType(
    // @ts-expect-error generics don't match
    <Comp msg="fse" list={[123]} />,
    {} as JSX.Element,
  )
  expectType(
    // @ts-expect-error generics don't match
    <Comp msg={123} list={['123']} />,
    {} as JSX.Element,
  )
})

describe('function syntax w/ emits', () => {
  const Foo = defineComponent(
    (props: { msg: string }, ctx) => {
      ctx.emit('foo')
      // @ts-expect-error
      ctx.emit('bar')
      return () => {}
    },
    {
      emits: ['foo'],
    },
  )
  expectType(<Foo msg="hi" onFoo={() => {}} />, {} as JSX.Element)
  // @ts-expect-error
  expectType(<Foo msg="hi" onBar={() => {}} />, {} as JSX.Element)

  defineComponent(
    (props: { msg: string }, ctx) => {
      ctx.emit('foo', 'hi')
      // @ts-expect-error
      ctx.emit('foo')
      // @ts-expect-error
      ctx.emit('bar')
      return () => {}
    },
    {
      emits: {
        foo: (a: string) => true,
      },
    },
  )

  const NamedTupleEmit = defineComponent<
    {},
    {
      update: [value: string] // named tuple syntax
    }
  >((_props, ctx) => {
    ctx.emit('update', '123')
    // @ts-expect-error
    ctx.emit('update', 123)
    // @ts-expect-error
    ctx.emit('non-exist')
    return () => {}
  })
  expectType(
    <NamedTupleEmit
      onUpdate={value => {
        expectType(value.toUpperCase(), {} as string)
        // @ts-expect-error string payload should not expose number methods
        value.toFixed()
      }}
    />,
    {} as JSX.Element,
  )
})

describe('function syntax w/ runtime props', () => {
  // with runtime props, the runtime props must match
  // manual type declaration
  const Comp1 = defineComponent(
    (_props: { msg: string }) => {
      return () => {}
    },
    {
      props: ['msg'],
    },
  )

  // @ts-expect-error bar isn't specified in props definition
  defineComponent(
    (_props: { msg: string }) => {
      return () => {}
    },
    {
      props: ['msg', 'bar'],
    },
  )

  defineComponent(
    (_props: { msg: string; bar: string }) => {
      return () => {}
    },
    {
      props: ['msg'],
    },
  )

  expectType(<Comp1 msg="1" />, {} as JSX.Element)
  // @ts-expect-error msg type is incorrect
  expectType(<Comp1 msg={1} />, {} as JSX.Element)
  // @ts-expect-error msg is missing
  expectType(<Comp1 />, {} as JSX.Element)
  // @ts-expect-error bar doesn't exist
  expectType(<Comp1 msg="1" bar="2" />, {} as JSX.Element)

  const Comp2 = defineComponent(
    <T extends string>(_props: { msg: T }) => {
      return () => {}
    },
    {
      props: ['msg'],
    },
  )

  // @ts-expect-error bar isn't specified in props definition
  defineComponent(
    <T extends string>(_props: { msg: T }) => {
      return () => {}
    },
    {
      props: ['msg', 'bar'],
    },
  )

  defineComponent(
    <T extends string>(_props: { msg: T; bar: T }) => {
      return () => {}
    },
    {
      props: ['msg'],
    },
  )

  expectType(<Comp2 msg="1" />, {} as JSX.Element)
  expectType(<Comp2<string> msg="1" />, {} as JSX.Element)
  // @ts-expect-error msg type is incorrect
  expectType(<Comp2 msg={1} />, {} as JSX.Element)
  // @ts-expect-error msg is missing
  expectType(<Comp2 />, {} as JSX.Element)
  // @ts-expect-error bar doesn't exist
  expectType(<Comp2 msg="1" bar="2" />, {} as JSX.Element)

  // Note: generics aren't supported with object runtime props
  const Comp3 = defineComponent(
    <T extends string>(_props: { msg: T }) => {
      return () => {}
    },
    {
      props: {
        msg: String,
      },
    },
  )

  defineComponent(
    // @ts-expect-error bar isn't specified in props definition
    <T extends string>(_props: { msg: T }) => {
      return () => {}
    },
    {
      props: {
        bar: String,
      },
    },
  )

  defineComponent(
    // @ts-expect-error generics aren't supported with object runtime props
    <T extends string>(_props: { msg: T; bar: T }) => {
      return () => {}
    },
    {
      props: {
        msg: String,
      },
    },
  )

  expectType(<Comp3 msg="1" />, {} as JSX.Element)
  // @ts-expect-error generics aren't supported with object runtime props
  expectType(<Comp3<string> msg="1" />, {} as JSX.Element)
  // @ts-expect-error msg type is incorrect
  expectType(<Comp3 msg={1} />, {} as JSX.Element)
  // @ts-expect-error msg is missing
  expectType(<Comp3 />, {} as JSX.Element)
  // @ts-expect-error bar doesn't exist
  expectType(<Comp3 msg="1" bar="2" />, {} as JSX.Element)

  // @ts-expect-error string prop names don't match
  defineComponent(
    (_props: { msg: string }) => {
      return () => {}
    },
    {
      props: ['bar'],
    },
  )

  defineComponent(
    (_props: { msg: string }) => {
      return () => {}
    },
    {
      props: {
        // @ts-expect-error prop type mismatch
        msg: Number,
      },
    },
  )
})

// check if defineComponent can be exported
export default {
  // function components
  a: defineComponent(_ => () => h('div')),
  // no props
  b: defineComponent({
    data() {
      return {}
    },
  }),
  c: defineComponent({
    props: ['a'],
  }),
  d: defineComponent({
    props: {
      a: Number,
    },
  }),
}

describe('slots', () => {
  const comp1 = defineComponent({
    slots: Object as SlotsType<{
      default: { foo: string; bar: number }
      optional?: { data: string }
      undefinedScope: undefined | { data: string }
      optionalUndefinedScope?: undefined | { data: string }
    }>,
    setup(props, { slots }) {
      expectType(
        slots.default,
        {} as (scope: { foo: string; bar: number }) => VNode[],
      )
      expectAssignable<((scope: { data: string }) => VNode[]) | undefined>(
        slots.optional,
      )

      slots.default({ foo: 'foo', bar: 1 })

      // @ts-expect-error it's optional
      slots.optional({ data: 'foo' })
      slots.optional?.({ data: 'foo' })

      expectAssignable<{
        (): VNode[]
        (scope: undefined | { data: string }): VNode[]
      }>(slots.undefinedScope)

      expectAssignable<
        | { (): VNode[]; (scope: undefined | { data: string }): VNode[] }
        | undefined
      >(slots.optionalUndefinedScope)

      slots.default({ foo: 'foo', bar: 1 })
      // @ts-expect-error it's optional
      slots.optional({ data: 'foo' })
      slots.optional?.({ data: 'foo' })
      slots.undefinedScope()
      slots.undefinedScope(undefined)
      // @ts-expect-error
      slots.undefinedScope('foo')

      slots.optionalUndefinedScope?.()
      slots.optionalUndefinedScope?.(undefined)
      slots.optionalUndefinedScope?.({ data: 'foo' })
      // @ts-expect-error
      slots.optionalUndefinedScope()
      // @ts-expect-error
      slots.optionalUndefinedScope?.('foo')

      expectAssignable<typeof slots | undefined>(new comp1().$slots)
    },
  })

  const comp2 = defineComponent({
    setup(props, { slots }) {
      // unknown slots
      expectType(slots, {} as Slots)
      expectType(slots.default, {} as ((...args: any[]) => VNode[]) | undefined)
    },
  })
  expectAssignable<Slots | undefined>(new comp2().$slots)
})

// #5885
describe('should work when props type is incompatible with setup returned type ', () => {
  type SizeType = 'small' | 'big'
  const Comp = defineComponent({
    props: {
      size: {
        type: String as PropType<SizeType>,
        required: true,
      },
    },
    setup(props) {
      expectType(props.size, {} as SizeType)
      return {
        size: 1,
      }
    },
  })
  type CompInstance = InstanceType<typeof Comp>

  const CompA = {} as CompInstance
  expectAssignable<ComponentPublicInstance>(CompA)
  expectType(CompA.size, {} as number)
  expectType(CompA.$props.size, {} as SizeType)
})

describe('withKeys and withModifiers as pro', () => {
  const onKeydown = withKeys(e => {}, [''])
  const onClick = withModifiers(e => {}, [])
  ;<input onKeydown={onKeydown} onClick={onClick} />
})

// #3367 expose components types
describe('expose component types', () => {
  const child = defineComponent({
    props: {
      a: String,
    },
  })

  const parent = defineComponent({
    components: {
      child,
      child2: {
        template: `<div></div>`,
      },
    },
  })

  expectType(parent.components!.child, {} as typeof child)
  expectAssignable<Component>(parent.components!.child2)

  // global components
  expectAssignable<Readonly<KeepAliveProps>>(
    new parent.components!.KeepAlive().$props,
  )
  expectAssignable<Readonly<KeepAliveProps>>(
    new child.components!.KeepAlive().$props,
  )

  // runtime-dom components
  expectAssignable<Readonly<TransitionProps>>(
    new parent.components!.Transition().$props,
  )
  expectAssignable<Readonly<TransitionProps>>(
    new child.components!.Transition().$props,
  )
})

describe('directive typing', () => {
  const customDirective: Directive = {
    created(_) {},
  }

  const comp = defineComponent({
    props: {
      a: String,
    },
    directives: {
      customDirective,
      localDirective: {
        created(_, { arg }) {
          expectAssignable<string | undefined>(arg)
        },
      },
    },
  })

  expectType(comp.directives!.customDirective, {} as typeof customDirective)
  expectAssignable<Directive>(comp.directives!.localDirective)

  // global directive
  expectType(comp.directives!.vShow, {} as typeof vShow)
})

describe('expose typing', () => {
  const Comp = defineComponent({
    expose: ['a', 'b'],
    props: {
      some: String,
    },
    data() {
      return { a: 1, b: '2', c: 1 }
    },
  })

  expectType(Comp.expose!, {} as Array<'a' | 'b'>)

  const vm = new Comp()
  // internal should still be exposed
  vm.$props

  expectType(vm.a, {} as number)
  expectType(vm.b, {} as string)

  // @ts-expect-error shouldn't be exposed
  vm.c
})

import type {
  AllowedComponentProps,
  ComponentCustomProps,
  ComponentInstance,
  ComponentOptionsMixin,
  DefineComponent,
  Directive,
  EmitsOptions,
  ExtractPropTypes,
  KeepAliveProps,
  TransitionProps,
  VNodeProps,
  vShow,
} from 'vue'

// code generated by tsc / vue-tsc, make sure this continues to work
// so we don't accidentally change the args order of DefineComponent
declare const MyButton: DefineComponent<
  {},
  () => JSX.Element,
  {},
  {},
  {},
  ComponentOptionsMixin,
  ComponentOptionsMixin,
  EmitsOptions,
  string,
  VNodeProps & AllowedComponentProps & ComponentCustomProps,
  Readonly<ExtractPropTypes<{}>>,
  {},
  {}
>
;<MyButton class="x" />

describe('__typeProps backdoor for union type for conditional props', () => {
  interface CommonProps {
    size?: 'xl' | 'l' | 'm' | 's' | 'xs'
  }

  type ConditionalProps =
    | {
        color?: 'normal' | 'primary' | 'secondary'
        appearance?: 'normal' | 'outline' | 'text'
      }
    | {
        color: 'white'
        appearance: 'outline'
      }

  type Props = CommonProps & ConditionalProps

  const Comp = defineComponent({
    __typeProps: {} as Props,
  })
  // @ts-expect-error
  ;<Comp color="white" />
  // @ts-expect-error
  ;<Comp color="white" appearance="normal" />
  ;<Comp color="white" appearance="outline" />

  const c = new Comp()

  // @ts-expect-error
  c.$props = { color: 'white' }
  // @ts-expect-error
  c.$props = { color: 'white', appearance: 'text' }
  c.$props = { color: 'white', appearance: 'outline' }
})

describe('__typeEmits backdoor, 3.3+ object syntax', () => {
  type Emits = {
    change: [id: number]
    update: [value: string]
  }

  const Comp = defineComponent({
    __typeEmits: {} as Emits,
    mounted() {
      this.$props.onChange?.(123)
      // @ts-expect-error
      this.$props.onChange?.('123')
      this.$props.onUpdate?.('foo')
      // @ts-expect-error
      this.$props.onUpdate?.(123)

      // @ts-expect-error
      this.$emit('foo')

      this.$emit('change', 123)
      // @ts-expect-error
      this.$emit('change', '123')

      this.$emit('update', 'test')
      // @ts-expect-error
      this.$emit('update', 123)
    },
  })

  ;<Comp onChange={id => id.toFixed(2)} />
  ;<Comp onUpdate={id => id.toUpperCase()} />
  // @ts-expect-error
  ;<Comp onChange={id => id.slice(1)} />
  // @ts-expect-error
  ;<Comp onUpdate={id => id.toFixed(2)} />

  const c = new Comp()
  // @ts-expect-error
  c.$emit('foo')

  c.$emit('change', 123)
  // @ts-expect-error
  c.$emit('change', '123')

  c.$emit('update', 'test')
  // @ts-expect-error
  c.$emit('update', 123)
})

describe('__typeEmits backdoor, call signature syntax', () => {
  type Emits = {
    (e: 'change', id: number): void
    (e: 'update', value: string): void
  }

  const Comp = defineComponent({
    __typeEmits: {} as Emits,
    mounted() {
      this.$props.onChange?.(123)
      // @ts-expect-error
      this.$props.onChange?.('123')
      this.$props.onUpdate?.('foo')
      // @ts-expect-error
      this.$props.onUpdate?.(123)

      // @ts-expect-error
      this.$emit('foo')

      this.$emit('change', 123)
      // @ts-expect-error
      this.$emit('change', '123')

      this.$emit('update', 'test')
      // @ts-expect-error
      this.$emit('update', 123)
    },
  })

  ;<Comp onChange={id => id.toFixed(2)} />
  ;<Comp onUpdate={id => id.toUpperCase()} />
  // @ts-expect-error
  ;<Comp onChange={id => id.slice(1)} />
  // @ts-expect-error
  ;<Comp onUpdate={id => id.toFixed(2)} />

  const c = new Comp()
  // @ts-expect-error
  c.$emit('foo')

  c.$emit('change', 123)
  // @ts-expect-error
  c.$emit('change', '123')

  c.$emit('update', 'test')
  // @ts-expect-error
  c.$emit('update', 123)
})

describe('__typeRefs backdoor, object syntax', () => {
  type Refs = {
    foo: number
  }

  const Parent = defineComponent({
    __typeRefs: {} as { child: ComponentInstance<typeof Child> },
  })
  const Child = defineComponent({
    __typeRefs: {} as Refs,
  })
  const c = new Parent()
  const refs = c.$refs

  expectType(refs.child, {} as ComponentInstance<typeof Child>)
  expectType(refs.child.$refs.foo, {} as number)
})

describe('__typeEl backdoor', () => {
  const Comp = defineComponent({
    __typeEl: {} as HTMLAnchorElement,
  })
  const c = new Comp()

  expectType(c.$el, {} as HTMLAnchorElement)
})

describe('__typeEl with a non-DOM host node (custom renderer)', () => {
  // Custom renderers (TUI, canvas, native, …) have host nodes that are not
  // DOM Elements. `$el` must accept them — `TypeEl` is not constrained to
  // `Element`.
  interface CustomElement {
    foo: string
  }
  const Comp = defineComponent({
    __typeEl: {} as CustomElement,
  })
  const c = new Comp()

  expectType(c.$el, {} as CustomElement)
  expectType(c.$el.foo, {} as string)
})

defineComponent({
  props: {
    foo: [String, null],
  },
  setup(props) {
    expectType(props.foo, {} as string | null | undefined)
  },
})

import type * as vue from 'vue'

interface ErrorMessageSlotProps {
  message: string | undefined
}
/**
 * #10842
 * component types generated by vue-tsc
 * relying on legacy CreateComponentPublicInstance signature
 */
declare const ErrorMessage: {
  new (...args: any[]): vue.CreateComponentPublicInstance<
    Readonly<
      vue.ExtractPropTypes<{
        as: {
          type: StringConstructor
          default: any
        }
        name: {
          type: StringConstructor
          required: true
        }
      }>
    >,
    () =>
      | VNode<
          vue.RendererNode,
          vue.RendererElement,
          {
            [key: string]: any
          }
        >
      | vue.Slot<any>
      | VNode<
          vue.RendererNode,
          vue.RendererElement,
          {
            [key: string]: any
          }
        >[]
      | {
          default: () => VNode<
            vue.RendererNode,
            vue.RendererElement,
            {
              [key: string]: any
            }
          >[]
        },
    unknown,
    {},
    {},
    vue.ComponentOptionsMixin,
    vue.ComponentOptionsMixin,
    {},
    vue.VNodeProps &
      vue.AllowedComponentProps &
      vue.ComponentCustomProps &
      Readonly<
        vue.ExtractPropTypes<{
          as: {
            type: StringConstructor
            default: any
          }
          name: {
            type: StringConstructor
            required: true
          }
        }>
      >,
    {
      as: string
    },
    true,
    {},
    {},
    {
      P: {}
      B: {}
      D: {}
      C: {}
      M: {}
      Defaults: {}
    },
    Readonly<
      vue.ExtractPropTypes<{
        as: {
          type: StringConstructor
          default: any
        }
        name: {
          type: StringConstructor
          required: true
        }
      }>
    >,
    () =>
      | VNode<
          vue.RendererNode,
          vue.RendererElement,
          {
            [key: string]: any
          }
        >
      | vue.Slot<any>
      | VNode<
          vue.RendererNode,
          vue.RendererElement,
          {
            [key: string]: any
          }
        >[]
      | {
          default: () => VNode<
            vue.RendererNode,
            vue.RendererElement,
            {
              [key: string]: any
            }
          >[]
        },
    {},
    {},
    {},
    {
      as: string
    }
  >
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never
} & vue.ComponentOptionsBase<
  Readonly<
    vue.ExtractPropTypes<{
      as: {
        type: StringConstructor
        default: any
      }
      name: {
        type: StringConstructor
        required: true
      }
    }>
  >,
  () =>
    | VNode<
        vue.RendererNode,
        vue.RendererElement,
        {
          [key: string]: any
        }
      >
    | vue.Slot<any>
    | VNode<
        vue.RendererNode,
        vue.RendererElement,
        {
          [key: string]: any
        }
      >[]
    | {
        default: () => VNode<
          vue.RendererNode,
          vue.RendererElement,
          {
            [key: string]: any
          }
        >[]
      },
  unknown,
  {},
  {},
  vue.ComponentOptionsMixin,
  vue.ComponentOptionsMixin,
  {},
  string,
  {
    as: string
  },
  {},
  string,
  {}
> &
  vue.VNodeProps &
  vue.AllowedComponentProps &
  vue.ComponentCustomProps &
  (new () => {
    $slots: {
      default: (arg: ErrorMessageSlotProps) => VNode[]
    }
  })
;<ErrorMessage name="password" class="error" />

// #10843
createApp({}).component(
  'SomeComponent',
  defineComponent({
    props: {
      title: String,
    },
    setup(props) {
      expectType(props.title, {} as string | undefined)
      return {}
    },
  }),
)

const Comp = defineComponent({
  props: {
    actionText: {
      type: {} as PropType<string>,
      default: 'Become a sponsor',
    },
  },
  __typeProps: {} as {
    actionText?: string
  },
})

const instance = new Comp()
function expectString(s: string) {}
// instance prop with default should be non-null
expectString(instance.actionText)

// public prop on $props should be optional
// @ts-expect-error
expectString(instance.$props.actionText)

// #12122
defineComponent({
  props: { foo: String },
  render() {
    expectType(this.$props, {} as { readonly foo?: string })
  },
})

// #14117
defineComponent({
  setup() {
    const setup1 = ref('setup1')
    const setup2 = ref('setup2')
    return { setup1, setup2 }
  },
  data() {
    return {
      data1: 1,
    }
  },
  props: {
    props1: {
      type: String,
    },
  },
  methods: {
    methods1() {
      return `methods1`
    },
  },
  computed: {
    computed1() {
      this.setup1
      this.setup2
      this.data1
      this.props1
      this.methods1()
      return `computed1`
    },
  },
  expose: ['setup1'],
})
