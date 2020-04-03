import { expectError, expectType } from 'tsd'
import {
  describe,
  defineComponent,
  PropType,
  ref,
  reactive,
  createApp
} from './index'

describe('with object props', () => {
  interface ExpectedProps {
    a?: number | undefined
    b: string
    e?: Function
    bb: string
    cc?: string[] | undefined
    dd: { n: 1 }
    ee?: () => string
    ff?: (a: number, b: string) => { a: boolean }
    ccc?: string[] | undefined
    ddd: string[]
    eee: () => { a: string }
    fff: (a: number, b: string) => { a: boolean }
  }

  type GT = string & { __brand: unknown }

  const MyComponent = defineComponent({
    props: {
      a: Number,
      // required should make property non-void
      b: {
        type: String,
        required: true
      },
      e: Function,
      // default value should infer type and make it non-void
      bb: {
        default: 'hello'
      },
      // explicit type casting
      cc: Array as PropType<string[]>,
      // required + type casting
      dd: {
        type: Object as PropType<{ n: 1 }>,
        required: true
      },
      // return type
      ee: Function as PropType<() => string>,
      // arguments + object return
      ff: Function as PropType<(a: number, b: string) => { a: boolean }>,
      // explicit type casting with constructor
      ccc: Array as () => string[],
      // required + contructor type casting
      ddd: {
        type: Array as () => string[],
        required: true
      },
      // required + object return
      eee: {
        type: Function as PropType<() => { a: string }>,
        required: true
      },
      // required + arguments + object return
      fff: {
        type: Function as PropType<(a: number, b: string) => { a: boolean }>,
        required: true
      }
    },
    setup(props) {
      // type assertion. See https://github.com/SamVerschueren/tsd
      expectType<ExpectedProps['a']>(props.a)
      expectType<ExpectedProps['b']>(props.b)
      expectType<ExpectedProps['e']>(props.e)
      expectType<ExpectedProps['bb']>(props.bb)
      expectType<ExpectedProps['cc']>(props.cc)
      expectType<ExpectedProps['dd']>(props.dd)
      expectType<ExpectedProps['ee']>(props.ee)
      expectType<ExpectedProps['ff']>(props.ff)
      expectType<ExpectedProps['ccc']>(props.ccc)
      expectType<ExpectedProps['ddd']>(props.ddd)
      expectType<ExpectedProps['eee']>(props.eee)
      expectType<ExpectedProps['fff']>(props.fff)

      // props should be readonly
      expectError((props.a = 1))

      // setup context
      return {
        c: ref(1),
        d: {
          e: ref('hi')
        },
        f: reactive({
          g: ref('hello' as GT)
        })
      }
    },
    render() {
      const props = this.$props
      expectType<ExpectedProps['a']>(props.a)
      expectType<ExpectedProps['b']>(props.b)
      expectType<ExpectedProps['e']>(props.e)
      expectType<ExpectedProps['bb']>(props.bb)
      expectType<ExpectedProps['cc']>(props.cc)
      expectType<ExpectedProps['dd']>(props.dd)
      expectType<ExpectedProps['ee']>(props.ee)
      expectType<ExpectedProps['ff']>(props.ff)
      expectType<ExpectedProps['ccc']>(props.ccc)
      expectType<ExpectedProps['ddd']>(props.ddd)
      expectType<ExpectedProps['eee']>(props.eee)
      expectType<ExpectedProps['fff']>(props.fff)

      // props should be readonly
      expectError((props.a = 1))

      // should also expose declared props on `this`
      expectType<ExpectedProps['a']>(this.a)
      expectType<ExpectedProps['b']>(this.b)
      expectType<ExpectedProps['e']>(this.e)
      expectType<ExpectedProps['bb']>(this.bb)
      expectType<ExpectedProps['cc']>(this.cc)
      expectType<ExpectedProps['dd']>(this.dd)
      expectType<ExpectedProps['ee']>(this.ee)
      expectType<ExpectedProps['ff']>(this.ff)
      expectType<ExpectedProps['ccc']>(this.ccc)
      expectType<ExpectedProps['ddd']>(this.ddd)
      expectType<ExpectedProps['eee']>(this.eee)
      expectType<ExpectedProps['fff']>(this.fff)

      // props on `this` should be readonly
      expectError((this.a = 1))

      // assert setup context unwrapping
      expectType<number>(this.c)
      expectType<string>(this.d.e)
      expectType<GT>(this.f.g)

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
      e={() => {}}
      cc={['cc']}
      dd={{ n: 1 }}
      ee={() => 'ee'}
      ccc={['ccc']}
      ddd={['ddd']}
      eee={() => ({ a: 'eee' })}
      fff={(a, b) => ({ a: a > +b })}
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
    <MyComponent a={'wrong type'} b="foo" dd={{ n: 1 }} ddd={['foo']} />
  )
  expectError(<MyComponent b="foo" dd={{ n: 'string' }} ddd={['foo']} />)
})

// describe('type inference w/ optional props declaration', () => {
//   const MyComponent = defineComponent({
//     setup(_props: { msg: string }) {
//       return {
//         a: 1
//       }
//     },
//     render() {
//       expectType<string>(this.$props.msg)
//       // props should be readonly
//       expectError((this.$props.msg = 'foo'))
//       // should not expose on `this`
//       expectError(this.msg)
//       expectType<number>(this.a)
//       return null
//     }
//   })

//   expectType<JSX.Element>(<MyComponent msg="foo" />)
//   expectError(<MyComponent />)
//   expectError(<MyComponent msg={1} />)
// })

// describe('type inference w/ direct setup function', () => {
//   const MyComponent = defineComponent((_props: { msg: string }) => {})
//   expectType<JSX.Element>(<MyComponent msg="foo" />)
//   expectError(<MyComponent />)
//   expectError(<MyComponent msg={1} />)
// })

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

describe('compatibility w/ createApp', () => {
  const comp = defineComponent({})
  createApp(comp).mount('#hello')

  const comp2 = defineComponent({
    props: { foo: String }
  })
  createApp(comp2).mount('#hello')

  const comp3 = defineComponent({
    setup() {
      return {
        a: 1
      }
    }
  })
  createApp(comp3).mount('#hello')
})

describe('defineComponent', () => {
  test('should accept components defined with defineComponent', () => {
    const comp = defineComponent({})
    defineComponent({
      components: { comp }
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
      input: (b: string) => null
    },
    setup(props, { emit }) {
      emit('click', 1)
      emit('input', 'foo')
      expectError(emit('nope'))
      expectError(emit('click'))
      expectError(emit('click', 'foo'))
      expectError(emit('input'))
      expectError(emit('input', 1))
    },
    created() {
      this.$emit('click', 1)
      this.$emit('input', 'foo')
      expectError(this.$emit('nope'))
      expectError(this.$emit('click'))
      expectError(this.$emit('click', 'foo'))
      expectError(this.$emit('input'))
      expectError(this.$emit('input', 1))
    }
  })

  // with array emits
  defineComponent({
    emits: ['foo', 'bar'],
    setup(props, { emit }) {
      emit('foo')
      emit('foo', 123)
      emit('bar')
      expectError(emit('nope'))
    },
    created() {
      this.$emit('foo')
      this.$emit('foo', 123)
      this.$emit('bar')
      expectError(this.$emit('nope'))
    }
  })
})
