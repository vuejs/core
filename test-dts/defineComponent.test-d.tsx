import { expectError, expectType } from 'tsd'
import { describe, defineComponent, PropType, ref, createApp } from './index'

describe('with object props', () => {
  interface ExpectedProps {
    a?: number | undefined
    b: string
    bb: string
    cc?: string[] | undefined
    dd: string[]
    ccc?: string[] | undefined
    ddd: string[]
  }

  const MyComponent = defineComponent({
    props: {
      a: Number,
      // required should make property non-void
      b: {
        type: String,
        required: true
      },
      // default value should infer type and make it non-void
      bb: {
        default: 'hello'
      },
      // explicit type casting
      cc: Array as PropType<string[]>,
      // required + type casting
      dd: {
        type: Array as PropType<string[]>,
        required: true
      },
      // explicit type casting with constructor
      ccc: Array as () => string[],
      // required + contructor type casting
      ddd: {
        type: Array as () => string[],
        required: true
      }
    },
    setup(props) {
      // type assertion. See https://github.com/SamVerschueren/tsd
      expectType<ExpectedProps['a']>(props.a)
      expectType<ExpectedProps['b']>(props.b)
      expectType<ExpectedProps['bb']>(props.bb)
      expectType<ExpectedProps['cc']>(props.cc)
      expectType<ExpectedProps['dd']>(props.dd)
      expectType<ExpectedProps['ccc']>(props.ccc)
      expectType<ExpectedProps['ddd']>(props.ddd)

      // props should be readonly
      expectError((props.a = 1))

      // setup context
      return {
        c: ref(1),
        d: {
          e: ref('hi')
        }
      }
    },
    render() {
      const props = this.$props
      expectType<ExpectedProps['a']>(props.a)
      expectType<ExpectedProps['b']>(props.b)
      expectType<ExpectedProps['bb']>(props.bb)
      expectType<ExpectedProps['cc']>(props.cc)
      expectType<ExpectedProps['dd']>(props.dd)
      expectType<ExpectedProps['ccc']>(props.ccc)
      expectType<ExpectedProps['ddd']>(props.ddd)

      // props should be readonly
      expectError((props.a = 1))

      // should also expose declared props on `this`
      expectType<ExpectedProps['a']>(this.a)
      expectType<ExpectedProps['b']>(this.b)
      expectType<ExpectedProps['bb']>(this.bb)
      expectType<ExpectedProps['cc']>(this.cc)
      expectType<ExpectedProps['dd']>(this.dd)
      expectType<ExpectedProps['ccc']>(this.ccc)
      expectType<ExpectedProps['ddd']>(this.ddd)

      // props on `this` should be readonly
      expectError((this.a = 1))

      // assert setup context unwrapping
      expectType<number>(this.c)
      expectType<string>(this.d.e)

      // setup context properties should be mutable
      this.c = 2

      return null
    }
  })

  // Test TSX
  expectType<JSX.Element>(
    <MyComponent
      a={1}
      b="b"
      bb="bb"
      cc={['cc']}
      dd={['dd']}
      ccc={['ccc']}
      ddd={['ddd']}
      // should allow extraneous as attrs
      class="bar"
      // should allow key
      key={'foo'}
      // should allow ref
      ref={'foo'}
    />
  )

  // missing required props
  expectError(<MyComponent />)

  // wrong prop types
  expectError(
    <MyComponent a={'wrong type'} b="foo" dd={['foo']} ddd={['foo']} />
  )
  expectError(<MyComponent b="foo" dd={[123]} ddd={['foo']} />)
})

describe('type inference w/ optional props declaration', () => {
  const MyComponent = defineComponent({
    setup(_props: { msg: string }) {
      return {
        a: 1
      }
    },
    render() {
      expectType<string>(this.$props.msg)
      // props should be readonly
      expectError((this.$props.msg = 'foo'))
      // should not expose on `this`
      expectError(this.msg)
      expectType<number>(this.a)
      return null
    }
  })

  expectType<JSX.Element>(<MyComponent msg="foo" />)
  expectError(<MyComponent />)
  expectError(<MyComponent msg={1} />)
})

describe('type inference w/ direct setup function', () => {
  const MyComponent = defineComponent((_props: { msg: string }) => {})
  expectType<JSX.Element>(<MyComponent msg="foo" />)
  expectError(<MyComponent />)
  expectError(<MyComponent msg={1} />)
})

describe('type inference w/ array props declaration', () => {
  defineComponent({
    props: ['a', 'b'],
    setup(props) {
      // props should be readonly
      expectError((props.a = 1))
      expectType<any>(props.a)
      expectType<any>(props.b)
      return {
        c: 1
      }
    },
    render() {
      expectType<any>(this.$props.a)
      expectType<any>(this.$props.b)
      expectError((this.$props.a = 1))
      expectType<any>(this.a)
      expectType<any>(this.b)
      expectType<number>(this.c)
    }
  })
})

describe('type inference w/ options API', () => {
  defineComponent({
    props: { a: Number },
    setup() {
      return {
        b: 123
      }
    },
    data() {
      // Limitation: we cannot expose the return result of setup() on `this`
      // here in data() - somehow that would mess up the inference
      expectType<number | undefined>(this.a)
      return {
        c: this.a || 123
      }
    },
    computed: {
      d(): number {
        expectType<number>(this.b)
        return this.b + 1
      }
    },
    watch: {
      a() {
        expectType<number>(this.b)
        this.b + 1
      }
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
      }
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
    }
  })
})

describe('with mixins', () => {
  const MixinA = defineComponent({
    props: {
      aP1: {
        type: String,
        default: 'aP1'
      },
      aP2: Boolean
    },
    data() {
      return {
        a: 1
      }
    }
  })
  const MixinB = defineComponent({
    props: ['bP1', 'bP2'],
    data() {
      return {
        b: 2
      }
    }
  })
  const MixinC = defineComponent({
    data() {
      return {
        c: 3
      }
    }
  })
  const MixinD = defineComponent({
    mixins: [MixinA],
    data() {
      return {
        d: 4
      }
    },
    computed: {
      dC1(): number {
        return this.d + this.a
      },
      dC2(): string {
        return this.aP1 + 'dC2'
      }
    }
  })
  const MyComponent = defineComponent({
    mixins: [MixinA, MixinB, MixinC, MixinD],
    props: {
      // required should make property non-void
      z: {
        type: String,
        required: true
      }
    },
    render() {
      const props = this.$props
      // props
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
      expectError((this.aP1 = 'new'))
      expectError((this.z = 1))

      // props on `this` should be readonly
      expectError((this.bP1 = 1))

      // string value can not assigned to number type value
      expectError((this.c = '1'))

      // setup context properties should be mutable
      this.d = 5

      return null
    }
  })

  // Test TSX
  expectType<JSX.Element>(
    <MyComponent aP1={'aP'} aP2 bP1={1} bP2={[1, 2]} z={'z'} />
  )

  // missing required props
  expectError(<MyComponent />)

  // wrong prop types
  expectError(<MyComponent aP1="ap" aP2={'wrong type'} bP1="b" z={'z'} />)
  expectError(<MyComponent aP1={1} bP2={[1]} />)
})

describe('with extends', () => {
  const Base = defineComponent({
    props: {
      aP1: Boolean,
      aP2: {
        type: Number,
        default: 2
      }
    },
    data() {
      return {
        a: 1
      }
    },
    computed: {
      c(): number {
        return this.aP2 + this.a
      }
    }
  })
  const MyComponent = defineComponent({
    extends: Base,
    props: {
      // required should make property non-void
      z: {
        type: String,
        required: true
      }
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
    }
  })

  // Test TSX
  expectType<JSX.Element>(<MyComponent aP2={3} aP1 z={'z'} />)

  // missing required props
  expectError(<MyComponent />)

  // wrong prop types
  expectError(<MyComponent aP1="ap" aP2={'wrong type'} z={'z'} />)
  expectError(<MyComponent aP1={1} aP2={'1'} />)
})

describe('compatibility w/ createApp', () => {
  const comp = defineComponent({})
  createApp().mount(comp, '#hello')

  const comp2 = defineComponent({
    props: { foo: String }
  })
  createApp().mount(comp2, '#hello')

  const comp3 = defineComponent({
    setup() {
      return {
        a: 1
      }
    }
  })
  createApp().mount(comp3, '#hello')
})
