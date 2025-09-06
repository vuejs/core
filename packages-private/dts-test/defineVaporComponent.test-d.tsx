import {
  type AllowedComponentProps,
  type Block,
  type Component,
  type ComponentCustomProps,
  type DefineVaporComponent,
  type EmitsOptions,
  type ExtractPropTypes,
  type GenericComponentInstance,
  type PropType,
  type VaporComponentInstance,
  type VaporPublicProps,
  createApp,
  createComponent,
  createVaporApp,
  defineVaporComponent,
  reactive,
  ref,
} from 'vue'
import { type IsAny, type IsUnion, describe, expectType } from './utils'

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

  const MyComponent = defineVaporComponent({
    props,
    setup(props) {
      // type assertion. See https://github.com/SamVerschueren/tsd
      expectType<ExpectedProps['a']>(props.a)
      expectType<ExpectedProps['aa']>(props.aa)
      expectType<ExpectedProps['aaa']>(props.aaa)

      // @ts-expect-error should included `undefined`
      expectType<number>(props.aaaa)
      expectType<ExpectedProps['aaaa']>(props.aaaa)

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
    render(ctx, props) {
      expectType<ExpectedProps['a']>(props.a)
      expectType<ExpectedProps['aa']>(props.aa)
      expectType<ExpectedProps['aaa']>(props.aaa)
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
      return []
    },
  })

  expectType<Component>(MyComponent)

  // Test TSX
  expectType<JSX.Element>(
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
  )

  expectType<Component>(
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
  defineVaporComponent({
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
  const MyComponent = defineVaporComponent<{ a: string[]; msg: string }>({
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
  const MyComponent = defineVaporComponent((_props: { msg: string }) => [])
  expectType<JSX.Element>(<MyComponent msg="foo" />)
  // @ts-expect-error
  ;<MyComponent />
  // @ts-expect-error
  ;<MyComponent msg={1} />
})

describe('type inference w/ array props declaration', () => {
  const MyComponent = defineVaporComponent({
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
    render(ctx, props) {
      expectType<any>(props.a)
      expectType<any>(props.b)
      // @ts-expect-error
      props.a = 1
      expectType<number>(ctx.c)
      return []
    },
  })
  expectType<JSX.Element>(<MyComponent a={[1, 2]} b="b" />)
  // @ts-expect-error
  ;<MyComponent other="other" />
})

// #4051
describe('type inference w/ empty prop object', () => {
  const MyComponent = defineVaporComponent({
    props: {},
    setup(props) {
      return {}
    },
    render() {
      return []
    },
  })
  expectType<JSX.Element>(<MyComponent />)
  // AllowedComponentProps
  expectType<JSX.Element>(<MyComponent class={'foo'} />)
  // ComponentCustomProps
  expectType<JSX.Element>(<MyComponent custom={1} />)
  // VNodeProps
  expectType<JSX.Element>(<MyComponent key="1" />)
  // @ts-expect-error
  expectError(<MyComponent other="other" />)
})

describe('compatibility w/ createComponent', () => {
  const comp = defineVaporComponent({})
  createComponent(comp)

  const comp2 = defineVaporComponent({
    props: { foo: String },
  })
  createComponent(comp2)

  const comp3 = defineVaporComponent({
    setup() {
      return {
        a: 1,
      }
    },
  })
  createComponent(comp3)

  const comp4 = defineVaporComponent(() => [])
  createComponent(comp4)
})

describe('compatibility w/ createApp', () => {
  const comp = defineVaporComponent({})
  createApp(comp).mount('#hello')

  const comp2 = defineVaporComponent({
    props: { foo: String },
  })
  createVaporApp(comp2).mount('#hello')

  const comp3 = defineVaporComponent({
    setup() {
      return {
        a: 1,
      }
    },
  })
  createVaporApp(comp3).mount('#hello')
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
  defineVaporComponent({
    emits: {
      click: (n: number) => typeof n === 'number',
      input: (b: string) => b.length > 1,
      Focus: (f: boolean) => !!f,
    },
    setup(props, { emit }) {
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
  })

  // with array emits
  defineVaporComponent({
    emits: ['foo', 'bar'],
    setup(props, { emit }) {
      emit('foo')
      emit('foo', 123)
      emit('bar')
      //  @ts-expect-error
      emit('nope')
    },
  })

  // with tsx
  const Component = defineVaporComponent({
    emits: {
      click: (n: number) => typeof n === 'number',
    },
    setup(props, { emit }) {
      emit('click', 1)
      //  @ts-expect-error
      emit('click')
      //  @ts-expect-error
      emit('click', 'foo')
    },
  })

  defineVaporComponent({
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
  const Hello = defineVaporComponent({
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
  defineVaporComponent({
    setup(props, { emit }) {
      emit('test', 1)
      emit('test')
    },
  })

  // emit should be valid when GenericComponentInstance is used.
  const instance = {} as GenericComponentInstance
  instance.emit('test', 1)
  instance.emit('test')

  // `this` should be void inside of emits validators
  defineVaporComponent({
    props: ['bar'],
    emits: {
      foo(): boolean {
        // @ts-expect-error
        return this.bar === 3
      },
    },
  })
})

describe('extract instance type', () => {
  const CompA = defineVaporComponent({
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

  expectType<boolean | undefined>(compA.props.a)
  expectType<string>(compA.props.b)
  expectType<number | undefined>(compA.props.c)

  //  @ts-expect-error
  compA.props.a = true
  //  @ts-expect-error
  compA.props.b = 'foo'
  //  @ts-expect-error
  compA.props.c = 1
})

describe('async setup', () => {
  type GT = string & { __brand: unknown }
  const Comp = defineVaporComponent({
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
    render(ctx) {
      // assert setup context unwrapping
      expectType<number>(ctx.a)
      expectType<string>(ctx.b.c.value)
      expectType<GT>(ctx.d.e)

      // setup context properties should be mutable
      ctx.a = 2
      return []
    },
  })

  const vm = {} as InstanceType<typeof Comp>
  // assert setup context unwrapping
  expectType<number>(vm.exposeProxy.a)
  expectType<string>(vm.exposeProxy.b.c.value)
  expectType<GT>(vm.exposeProxy.d.e)

  // setup context properties should be mutable
  vm.exposeProxy.a = 2
})

// #5948
describe('defineVaporComponent should infer correct types when assigning to Component', () => {
  let component: Component
  component = defineVaporComponent({
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
  const Child = defineVaporComponent({
    props: {
      bar: String,
    },
  })

  const Parent = defineVaporComponent({
    props: {
      ...Child.props,
      foo: String,
    },
  })

  const child = new Child()
  expectType<JSX.Element>(<Parent {...child.props} />)
})

// #6052
describe('prop starting with `on*` is broken', () => {
  defineVaporComponent({
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

  defineVaporComponent({
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
    },
  })
})

describe('function syntax w/ generics', () => {
  const Comp = defineVaporComponent(
    // TODO: babel plugin to auto infer runtime props options from type
    // similar to defineProps<{...}>()
    <T extends string | number>(props: { msg: T; list: T[] }) => {
      // use Composition API here like in <script setup>
      const count = ref(0)

      return (
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
  const Foo = defineVaporComponent(
    (props: { msg: string }, ctx) => {
      ctx.emit('foo')
      // @ts-expect-error
      ctx.emit('bar')
      return []
    },
    {
      emits: ['foo'],
    },
  )
  expectType<JSX.Element>(<Foo msg="hi" onFoo={() => {}} />)
  // @ts-expect-error
  expectType<JSX.Element>(<Foo msg="hi" onBar={() => {}} />)

  const Bar = defineVaporComponent(
    (props: { msg: string }, ctx) => {
      ctx.emit('foo', 'hi')
      // @ts-expect-error
      ctx.emit('foo')
      // @ts-expect-error
      ctx.emit('bar')
      return []
    },
    {
      emits: {
        foo: (a: string) => true,
      },
    },
  )
  expectType<JSX.Element>(<Bar msg="hi" onFoo={(a: string) => true} />)
  // @ts-expect-error
  expectType<JSX.Element>(<Foo msg="hi" onBar={() => {}} />)
})

describe('function syntax w/ slots', () => {
  // types
  type DefaultSlot = (props: { msg: string }) => []
  const Foo = defineVaporComponent(
    (_props, { slots }: { slots: { default: DefaultSlot } }) => {
      return slots.default({ msg: '' })
    },
  )
  const foo = new Foo()
  expectType<DefaultSlot>(foo.slots.default)

  // runtime
  const defaultSlot = (props: { msg: string }) => []
  const Bar = defineVaporComponent(
    (_props, { slots }) => {
      return slots.default({ msg: '' })
    },
    {
      slots: {
        default: defaultSlot,
      },
    },
  )
  const bar = new Bar()
  expectType<typeof defaultSlot>(bar.slots.default)
})

describe('function syntax w/ expose', () => {
  // types
  const Foo = defineVaporComponent(
    (
      props: { msg: string },
      { expose }: { expose: (exposed: { msg: string }) => void },
    ) => {
      expose({
        msg: props.msg,
      })
      return []
    },
  )
  const foo = new Foo()
  expectType<string>(foo.exposeProxy.msg)

  // runtime
  const Bar = defineVaporComponent(
    () => {
      return []
    },
    {
      setup: () => ({ msg: '' }),
    },
  )
  const bar = new Bar()
  expectType<string>(bar.exposeProxy.msg)
})

describe('function syntax w/ runtime props', () => {
  // with runtime props, the runtime props must match
  // manual type declaration
  defineVaporComponent(
    (_props: { msg: string }) => {
      return []
    },
    {
      props: ['msg'],
    },
  )

  defineVaporComponent(
    <T extends string>(_props: { msg: T }) => {
      return []
    },
    {
      props: ['msg'],
    },
  )

  defineVaporComponent(
    <T extends string>(_props: { msg: T }) => {
      return []
    },
    {
      props: {
        msg: String,
      },
    },
  )

  // @ts-expect-error string prop names don't match
  defineVaporComponent(
    (_props: { msg: string }) => {
      return []
    },
    {
      props: ['bar'],
    },
  )

  defineVaporComponent(
    (_props: { msg: string }) => {
      return []
    },
    {
      props: {
        // @ts-expect-error prop type mismatch
        msg: Number,
      },
    },
  )

  // @ts-expect-error prop keys don't match
  defineVaporComponent(
    (_props: { msg: string }, ctx) => {
      return []
    },
    {
      props: {
        msg: String,
        bar: String,
      },
    },
  )
})

// check if defineVaporComponent can be exported
export default {
  // function components
  a: defineVaporComponent(_ => []),
  // no props
  b: defineVaporComponent({}),
  c: defineVaporComponent({
    props: ['a'],
  }),
  d: defineVaporComponent({
    props: {
      a: Number,
    },
  }),
}

describe('slots', () => {
  const comp1 = defineVaporComponent({
    slots: {} as {
      default: (scope: { foo: string; bar: number }) => Block
      optional?: (scope: { data: string }) => Block
      undefinedScope: (scope?: { data: string }) => Block
      optionalUndefinedScope?: (scope?: { data: string }) => Block
    },
    setup(props, { slots }) {
      expectType<(scope: { foo: string; bar: number }) => Block>(slots.default)
      expectType<((scope: { data: string }) => Block) | undefined>(
        slots.optional,
      )

      slots.default({ foo: 'foo', bar: 1 })

      // @ts-expect-error it's optional
      slots.optional({ data: 'foo' })
      slots.optional?.({ data: 'foo' })

      expectType<{
        (): Block
        (scope: undefined | { data: string }): Block
      }>(slots.undefinedScope)

      expectType<
        { (): Block; (scope: undefined | { data: string }): Block } | undefined
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

      expectType<typeof slots | undefined>(new comp1().slots)
    },
  })

  const comp2 = defineVaporComponent({
    setup(props, { slots }) {
      // unknown slots
      expectType<Record<string, ((...args: any[]) => Block) | undefined>>(slots)
      expectType<((...args: any[]) => Block) | undefined>(slots.default)
    },
  })
  expectType<Record<string, ((...args: any[]) => Block) | undefined>>(
    new comp2().slots,
  )

  const comp3 = defineVaporComponent({
    setup(
      props,
      { slots }: { slots: { default: (props: { foo: number }) => Block } },
    ) {
      expectType<(props: { foo: number }) => Block>(slots.default)
    },
  })
  expectType<Record<string, (props: { foo: number }) => Block>>(
    new comp3().slots,
  )
})

describe('render', () => {
  defineVaporComponent({
    props: {
      foo: Number,
    },
    emits: {
      change: (e: number) => {},
    },
    slots: {} as { default: () => [] },
    setup() {
      return {
        bar: '',
      }
    },
    render(ctx, props, emit, attrs, slots) {
      expectType<number | undefined>(props.foo)
      expectType<string>(ctx.bar)
      emit('change', 1)
      return slots.default()
    },
  })
})

// #5885
describe('should work when props type is incompatible with setup returned type ', () => {
  type SizeType = 'small' | 'big'
  const Comp = defineVaporComponent({
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
  expectType<
    VaporComponentInstance<{ size: SizeType }, {}, {}, { size: number }>
  >(CompA)
  expectType<number>(CompA.exposeProxy.size)
  expectType<SizeType>(CompA.props.size)
})

describe('expose typing', () => {
  // types
  const Foo = defineVaporComponent(
    (
      props: { some?: string },
      { expose }: { expose: (exposed: { a: number; b: string }) => void },
    ) => {
      expose({ a: 1, b: '' })
    },
  )
  const foo = new Foo()
  // internal should still be exposed
  foo.props

  expectType<number>(foo.exposeProxy.a)
  expectType<string>(foo.exposeProxy.b)

  // runtime
  const Bar = defineVaporComponent({
    props: {
      some: String,
    },
    setup() {
      return { a: 1, b: '2', c: 1 }
    },
  })

  const bar = new Bar()
  // internal should still be exposed
  bar.props

  expectType<number>(bar.exposeProxy.a)
  expectType<string>(bar.exposeProxy.b)
})

// code generated by tsc / vue-tsc, make sure this continues to work
// so we don't accidentally change the args order of DefineComponent
declare const MyButton: DefineVaporComponent<
  {},
  string,
  EmitsOptions,
  string,
  {},
  {},
  Block,
  {},
  true,
  Readonly<ExtractPropTypes<{}>>,
  VaporPublicProps & AllowedComponentProps & ComponentCustomProps,
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

  const Comp = defineVaporComponent({
    __typeProps: {} as Props,
  })
  // @ts-expect-error
  ;<Comp color="white" />
  // @ts-expect-error
  ;<Comp color="white" appearance="normal" />
  ;<Comp color="white" appearance="outline" />

  const c = new Comp()

  // @ts-expect-error
  c.props = { color: 'white' }
  // @ts-expect-error
  c.props = { color: 'white', appearance: 'text' }
  c.props = { color: 'white', appearance: 'outline' }
})

describe('__typeEmits backdoor, 3.3+ object syntax', () => {
  type Emits = {
    change: [id: number]
    update: [value: string]
  }

  const Comp = defineVaporComponent({
    __typeEmits: {} as Emits,
    setup(props, { emit }) {
      // @ts-expect-error
      props.onChange?.('123')
      // @ts-expect-error
      props.onUpdate?.(123)

      // @ts-expect-error
      emit('foo')

      emit('change', 123)
      // @ts-expect-error
      emit('change', '123')

      emit('update', 'test')
      // @ts-expect-error
      emit('update', 123)
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
  c.emit('foo')

  c.emit('change', 123)
  // @ts-expect-error
  c.emit('change', '123')

  c.emit('update', 'test')
  // @ts-expect-error
  c.emit('update', 123)
})

describe('__typeEmits backdoor, call signature syntax', () => {
  type Emits = {
    (e: 'change', id: number): void
    (e: 'update', value: string): void
  }

  const Comp = defineVaporComponent({
    __typeEmits: {} as Emits,
    setup(props, { emit }) {
      // @ts-expect-error
      props.onChange?.('123')
      // @ts-expect-error
      props.onUpdate?.(123)

      // @ts-expect-error
      emit('foo')

      emit('change', 123)
      // @ts-expect-error
      emit('change', '123')

      emit('update', 'test')
      // @ts-expect-error
      emit('update', 123)
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
  c.emit('foo')

  c.emit('change', 123)
  // @ts-expect-error
  c.emit('change', '123')

  c.emit('update', 'test')
  // @ts-expect-error
  c.emit('update', 123)
})

describe('__typeRefs backdoor, object syntax', () => {
  type Refs = {
    foo: number
  }

  const Parent = defineVaporComponent({
    __typeRefs: {} as { child: InstanceType<typeof Child> },
  })
  const Child = defineVaporComponent({
    __typeRefs: {} as Refs,
  })
  const c = new Parent()
  const refs = c.refs

  expectType<InstanceType<typeof Child>>(refs.child)
  expectType<number>(refs.child.refs.foo)
})

describe('__typeEl backdoor', () => {
  const Comp = defineVaporComponent({
    __typeEl: {} as HTMLAnchorElement,
  })
  const c = new Comp()
  expectType<HTMLAnchorElement>(c.block)

  const Comp1 = defineVaporComponent({
    render: () => document.createElement('a'),
  })
  const c1 = new Comp1()
  expectType<HTMLAnchorElement>(c1.block)

  const Comp2 = defineVaporComponent(() => document.createElement('a'))
  const c2 = new Comp2()
  expectType<HTMLAnchorElement>(c2.block)

  const Comp3 = defineVaporComponent({
    setup: () => document.createElement('a'),
  })
  const c3 = new Comp3()
  expectType<HTMLAnchorElement>(c3.block)
})

defineVaporComponent({
  props: {
    foo: [String, null],
  },
  setup(props) {
    expectType<IsAny<typeof props.foo>>(false)
    expectType<string | null | undefined>(props.foo)
  },
})

// #10843
createApp({}).component(
  'SomeComponent',
  defineVaporComponent({
    props: {
      title: String,
    },
    setup(props) {
      expectType<string | undefined>(props.title)
      return {}
    },
  }),
)

const Comp = defineVaporComponent({
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
// public prop on props should be optional
// @ts-expect-error
expectString(instance.props.actionText)

// #12122
defineVaporComponent({
  props: { foo: String },
  render(ctx, props) {
    expectType<{ readonly foo?: string }>(props)
    // @ts-expect-error
    expectType<string>(props)
    return []
  },
})
