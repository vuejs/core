import {
  Component,
  defineComponent,
  PropType,
  ref,
  reactive,
  createApp,
  ComponentPublicInstance,
  ComponentOptions,
  SetupContext,
  h,
  SlotsType,
  Slots,
  VNode,
  withKeys,
  withModifiers,
} from 'vue'
import { describe, expectType, IsUnion } from './utils'

describe('with object props', () => {
  interface ExpectedProps {
    a?: number | undefined
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
      expectType<ExpectedProps['a']>(props.a)
      expectType<ExpectedProps['b']>(props.b)
      expectType<ExpectedProps['e']>(props.e)
      expectType<ExpectedProps['h']>(props.h)
      expectType<ExpectedProps['j']>(props.j)
      expectType<ExpectedProps['bb']>(props.bb)
      expectType<ExpectedProps['bbb']>(props.bbb)
      expectType<ExpectedProps['bbbb']>(props.bbbb)
      expectType<ExpectedProps['bbbbb']>(props.bbbbb)
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
      if (typeof props.iii !== 'function') {
        expectType<undefined>(props.iii)
      }
      expectType<ExpectedProps['iii']>(props.iii)
      expectType<IsUnion<typeof props.jjj>>(true)
      expectType<ExpectedProps['jjj']>(props.jjj)
      expectType<ExpectedProps['kkk']>(props.kkk)
      expectType<ExpectedProps['validated']>(props.validated)
      expectType<ExpectedProps['date']>(props.date)
      expectType<ExpectedProps['l']>(props.l)
      expectType<ExpectedProps['ll']>(props.ll)
      expectType<ExpectedProps['lll']>(props.lll)

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
      expectType<ExpectedProps['a']>(props.a)
      expectType<ExpectedProps['b']>(props.b)
      expectType<ExpectedProps['e']>(props.e)
      expectType<ExpectedProps['h']>(props.h)
      expectType<ExpectedProps['bb']>(props.bb)
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
      if (typeof props.iii !== 'function') {
        expectType<undefined>(props.iii)
      }
      expectType<ExpectedProps['iii']>(props.iii)
      expectType<IsUnion<typeof props.jjj>>(true)
      expectType<ExpectedProps['jjj']>(props.jjj)
      expectType<ExpectedProps['kkk']>(props.kkk)

      // @ts-expect-error props should be readonly
      props.a = 1

      // should also expose declared props on `this`
      expectType<ExpectedProps['a']>(this.a)
      expectType<ExpectedProps['b']>(this.b)
      expectType<ExpectedProps['e']>(this.e)
      expectType<ExpectedProps['h']>(this.h)
      expectType<ExpectedProps['bb']>(this.bb)
      expectType<ExpectedProps['cc']>(this.cc)
      expectType<ExpectedProps['dd']>(this.dd)
      expectType<ExpectedProps['ee']>(this.ee)
      expectType<ExpectedProps['ff']>(this.ff)
      expectType<ExpectedProps['ccc']>(this.ccc)
      expectType<ExpectedProps['ddd']>(this.ddd)
      expectType<ExpectedProps['eee']>(this.eee)
      expectType<ExpectedProps['fff']>(this.fff)
      expectType<ExpectedProps['hhh']>(this.hhh)
      expectType<ExpectedProps['ggg']>(this.ggg)
      if (typeof this.iii !== 'function') {
        expectType<undefined>(this.iii)
      }
      expectType<ExpectedProps['iii']>(this.iii)
      const { jjj } = this
      expectType<IsUnion<typeof jjj>>(true)
      expectType<ExpectedProps['jjj']>(this.jjj)
      expectType<ExpectedProps['kkk']>(this.kkk)

      // @ts-expect-error props on `this` should be readonly
      this.a = 1

      // assert setup context unwrapping
      expectType<number>(this.c)
      expectType<string>(this.d.e.value)
      expectType<GT>(this.f.g)

      // setup context properties should be mutable
      this.c = 2

      return null
    },
  })

  expectType<Component>(MyComponent)

  // Test TSX
  expectType<JSX.Element>(
    <MyComponent
      a={1}
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
  )

  expectType<Component>(
    <MyComponent
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
      expectType<string>(props.msg)
      expectType<string[]>(props.a)
      return {
        b: 1,
      }
    },
  })

  expectType<JSX.Element>(<MyComponent msg="1" a={['1']} />)
  // @ts-expect-error
  ;<MyComponent />
  // @ts-expect-error
  ;<MyComponent msg="1" />
})

describe('type inference w/ direct setup function', () => {
  const MyComponent = defineComponent((_props: { msg: string }) => () => {})
  expectType<JSX.Element>(<MyComponent msg="foo" />)
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
      expectType<any>(props.a)
      expectType<any>(props.b)
      return {
        c: 1,
      }
    },
    render() {
      expectType<any>(this.$props.a)
      expectType<any>(this.$props.b)
      // @ts-expect-error
      this.$props.a = 1
      expectType<any>(this.a)
      expectType<any>(this.b)
      expectType<number>(this.c)
    },
  })
  expectType<JSX.Element>(<MyComponent a={[1, 2]} b="b" />)
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
      expectType<number | undefined>(this.a)
      return {
        c: this.a || 123,
        someRef: ref(0),
      }
    },
    computed: {
      d() {
        expectType<number>(this.b)
        return this.b + 1
      },
      e: {
        get() {
          expectType<number>(this.b)
          expectType<number>(this.d)

          return this.b + this.d
        },
        set(v: number) {
          expectType<number>(this.b)
          expectType<number>(this.d)
          expectType<number>(v)
        },
      },
    },
    watch: {
      a() {
        expectType<number>(this.b)
        this.b + 1
      },
    },
    created() {
      // props
      expectType<number | undefined>(this.a)
      // returned from setup()
      expectType<number>(this.b)
      // returned from data()
      expectType<number>(this.c)
      // computed
      expectType<number>(this.d)
      // computed get/set
      expectType<number>(this.e)
      expectType<number>(this.someRef)
    },
    methods: {
      doSomething() {
        // props
        expectType<number | undefined>(this.a)
        // returned from setup()
        expectType<number>(this.b)
        // returned from data()
        expectType<number>(this.c)
        // computed
        expectType<number>(this.d)
        // computed get/set
        expectType<number>(this.e)
      },
      returnSomething() {
        return this.a
      },
    },
    render() {
      // props
      expectType<number | undefined>(this.a)
      // returned from setup()
      expectType<number>(this.b)
      // returned from data()
      expectType<number>(this.c)
      // computed
      expectType<number>(this.d)
      // computed get/set
      expectType<number>(this.e)
      // method
      expectType<() => number | undefined>(this.returnSomething)
    },
  })
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
      expectType<string>(props.aP1)
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
      expectType<number>(vm.a)
      expectType<number>(vm.b)
      expectType<number>(vm.c)
      expectType<number>(vm.d)

      // should also expose declared props on `this`
      expectType<number>(this.a)
      expectType<string>(this.aP1)
      expectType<boolean | undefined>(this.aP2)
      expectType<number>(this.b)
      expectType<any>(this.bP1)
      expectType<number>(this.c)
      expectType<number>(this.d)

      return {}
    },

    setup(props) {
      expectType<string>(props.z)
      // props
      expectType<((...args: any[]) => any) | undefined>(props.onClick)
      // from MixinA
      expectType<((...args: any[]) => any) | undefined>(props.onBar)
      expectType<string>(props.aP1)
      expectType<boolean | undefined>(props.aP2)
      expectType<any>(props.bP1)
      expectType<any>(props.bP2)
      expectType<string>(props.z)
    },
    render() {
      const props = this.$props
      // props
      expectType<((...args: any[]) => any) | undefined>(props.onClick)
      // from MixinA
      expectType<((...args: any[]) => any) | undefined>(props.onBar)
      expectType<string>(props.aP1)
      expectType<boolean | undefined>(props.aP2)
      expectType<any>(props.bP1)
      expectType<any>(props.bP2)
      expectType<string>(props.z)

      const data = this.$data
      expectType<number>(data.a)
      expectType<number>(data.b)
      expectType<number>(data.c)
      expectType<number>(data.d)

      // should also expose declared props on `this`
      expectType<number>(this.a)
      expectType<string>(this.aP1)
      expectType<boolean | undefined>(this.aP2)
      expectType<number>(this.b)
      expectType<any>(this.bP1)
      expectType<number>(this.c)
      expectType<number>(this.d)
      expectType<number>(this.dC1)
      expectType<string>(this.dC2)

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
  expectType<JSX.Element>(
    <MyComponent aP1={'aP'} aP2 bP1={1} bP2={[1, 2]} z={'z'} />,
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
      expectType<boolean | undefined>(props.aP1)
      expectType<number>(props.aP2)
      expectType<string>(props.z)

      const data = this.$data
      expectType<number>(data.a)

      // should also expose declared props on `this`
      expectType<number>(this.a)
      expectType<boolean | undefined>(this.aP1)
      expectType<number>(this.aP2)

      // setup context properties should be mutable
      this.a = 5

      return null
    },
  })

  // Test TSX
  expectType<JSX.Element>(<MyComponent aP2={3} aP1 z={'z'} />)

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
      expectType<((...args: any[]) => any) | undefined>(props.onClick)
      // from Mixin
      expectType<((...args: any[]) => any) | undefined>(props.onBar)
      // from Base
      expectType<((...args: any[]) => any) | undefined>(props.onFoo)
      expectType<boolean | undefined>(props.p1)
      expectType<number>(props.p2)
      expectType<string>(props.z)
      expectType<string>(props.mP1)
      expectType<boolean | undefined>(props.mP2)

      const data = this.$data
      expectType<number>(data.a)
      expectType<number>(data.b)

      // should also expose declared props on `this`
      expectType<number>(this.a)
      expectType<number>(this.b)
      expectType<boolean | undefined>(this.p1)
      expectType<number>(this.p2)
      expectType<string>(this.mP1)
      expectType<boolean | undefined>(this.mP2)

      // setup context properties should be mutable
      this.a = 5

      return null
    },
  })

  // Test TSX
  expectType<JSX.Element>(<MyComponent mP1="p1" mP2 mP3 p1 p2={1} p3 z={'z'} />)

  // mP1, mP2, p1, and p2 have default value. these are not required
  expectType<JSX.Element>(<MyComponent mP3 p3 z={'z'} />)

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
      expectType<number>(this.foo)
    },
  })
  defineComponent({
    mixins: [CompWithC, CompEmpty],
    mounted() {
      expectType<number>(this.foo)
    },
  })
  defineComponent({
    mixins: [CompWithM, CompEmpty],
    mounted() {
      expectType<() => void>(this.foo)
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
    },
    setup(props, { emit }) {
      expectType<((n: number) => boolean) | undefined>(props.onClick)
      expectType<((b: string) => boolean) | undefined>(props.onInput)
      emit('click', 1)
      emit('input', 'foo')
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
      })
    },
  })

  // with array emits
  defineComponent({
    emits: ['foo', 'bar'],
    setup(props, { emit }) {
      expectType<((...args: any[]) => any) | undefined>(props.onFoo)
      expectType<((...args: any[]) => any) | undefined>(props.onBar)
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
      expectType<((n: number) => any) | undefined>(props.onClick)
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
      expectType<unknown>(this.foo)
      expectType<unknown>(this.bar)
      //  @ts-expect-error
      this.foobar = 1
    },
  })

  // with array inject
  defineComponent({
    props: ['a', 'b'],
    inject: ['foo', 'bar'],
    created() {
      expectType<unknown>(this.foo)
      expectType<unknown>(this.bar)
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
      expectType<unknown>(this.foo)
      expectType<unknown>(this.bar)
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
  expectType<ComponentOptions['setup']>(
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

  expectType<boolean>(compA.a)
  expectType<string>(compA.b)
  expectType<number | undefined>(compA.c)
  // mixins
  expectType<string>(compA.mA)
  // extends
  expectType<number>(compA.baseA)

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
      expectType<number>(this.a)
      expectType<string>(this.b.c.value)
      expectType<GT>(this.d.e)

      // setup context properties should be mutable
      this.a = 2
    },
  })

  const vm = {} as InstanceType<typeof Comp>
  // assert setup context unwrapping
  expectType<number>(vm.a)
  expectType<string>(vm.b.c.value)
  expectType<GT>(vm.d.e)

  // setup context properties should be mutable
  vm.a = 2
})

// #5948
describe('DefineComponent should infer correct types when assigning to Component', () => {
  let component: Component
  component = defineComponent({
    setup(_, { attrs, slots }) {
      // @ts-expect-error should not be any
      expectType<[]>(attrs)
      // @ts-expect-error should not be any
      expectType<[]>(slots)
    },
  })
  expectType<Component>(component)
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
  expectType<JSX.Element>(<Parent {...child.$props} />)
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
      expectType<(a: 1) => void>(props.onX)
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
      expectType<(a: 1) => void>(props.onX)
      expectType<undefined | ((a: 1) => any)>(props.onTest)
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

  expectType<JSX.Element>(<Comp msg="fse" list={['foo']} />)
  expectType<JSX.Element>(<Comp msg={123} list={[123]} />)

  expectType<JSX.Element>(
    // @ts-expect-error missing prop
    <Comp msg={123} />,
  )

  expectType<JSX.Element>(
    // @ts-expect-error generics don't match
    <Comp msg="fse" list={[123]} />,
  )
  expectType<JSX.Element>(
    // @ts-expect-error generics don't match
    <Comp msg={123} list={['123']} />,
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
  expectType<JSX.Element>(<Foo msg="hi" onFoo={() => {}} />)
  // @ts-expect-error
  expectType<JSX.Element>(<Foo msg="hi" onBar={() => {}} />)

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
})

describe('function syntax w/ runtime props', () => {
  // with runtime props, the runtime props must match
  // manual type declaration
  defineComponent(
    (_props: { msg: string }) => {
      return () => {}
    },
    {
      props: ['msg'],
    },
  )

  defineComponent(
    <T extends string>(_props: { msg: T }) => {
      return () => {}
    },
    {
      props: ['msg'],
    },
  )

  defineComponent(
    <T extends string>(_props: { msg: T }) => {
      return () => {}
    },
    {
      props: {
        msg: String,
      },
    },
  )

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

  // @ts-expect-error prop keys don't match
  defineComponent(
    (_props: { msg: string }, ctx) => {
      return () => {}
    },
    {
      props: {
        msg: String,
        bar: String,
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
      expectType<(scope: { foo: string; bar: number }) => VNode[]>(
        slots.default,
      )
      expectType<((scope: { data: string }) => VNode[]) | undefined>(
        slots.optional,
      )

      slots.default({ foo: 'foo', bar: 1 })

      // @ts-expect-error it's optional
      slots.optional({ data: 'foo' })
      slots.optional?.({ data: 'foo' })

      expectType<{
        (): VNode[]
        (scope: undefined | { data: string }): VNode[]
      }>(slots.undefinedScope)

      expectType<
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

      expectType<typeof slots | undefined>(new comp1().$slots)
    },
  })

  const comp2 = defineComponent({
    setup(props, { slots }) {
      // unknown slots
      expectType<Slots>(slots)
      expectType<((...args: any[]) => VNode[]) | undefined>(slots.default)
    },
  })
  expectType<Slots | undefined>(new comp2().$slots)
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
      expectType<SizeType>(props.size)
      return {
        size: 1,
      }
    },
  })
  type CompInstance = InstanceType<typeof Comp>

  const CompA = {} as CompInstance
  expectType<ComponentPublicInstance>(CompA)
  expectType<number>(CompA.size)
  expectType<SizeType>(CompA.$props.size)
})

describe('withKeys and withModifiers as pro', () => {
  const onKeydown = withKeys(e => {}, [''])
  const onClick = withModifiers(e => {}, [''])
  ;<input onKeydown={onKeydown} onClick={onClick} />
})

import {
  DefineComponent,
  ComponentOptionsMixin,
  EmitsOptions,
  VNodeProps,
  AllowedComponentProps,
  ComponentCustomProps,
  ExtractPropTypes,
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
