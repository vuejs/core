import {
  describe,
  h,
  defineComponent,
  ref,
  Fragment,
  Teleport,
  Suspense,
  Component,
  expectError,
  expectAssignable,
  FunctionalComponent,
  expectType
} from './index'

describe('h inference w/ element', () => {
  // key
  h('div', { key: 1 })
  h('div', { key: 'foo' })
  //  @ts-expect-error
  expectError(h('div', { key: [] }))
  //  @ts-expect-error
  expectError(h('div', { key: {} }))
  // ref
  h('div', { ref: 'foo' })
  h('div', { ref: ref(null) })
  h('div', { ref: _el => {} })
  //  @ts-expect-error
  expectError(h('div', { ref: [] }))
  //  @ts-expect-error
  expectError(h('div', { ref: {} }))
  //  @ts-expect-error
  expectError(h('div', { ref: 123 }))
  // slots
  const slots = { default: () => {} } // RawSlots
  h('div', {}, slots)
})

describe('h inference w/ Fragment', () => {
  // only accepts array children
  h(Fragment, ['hello'])
  h(Fragment, { key: 123 }, ['hello'])
  // @ts-expect-error
  expectError(h(Fragment, 'foo'))
  //  @ts-expect-error
  expectError(h(Fragment, { key: 123 }, 'bar'))
})

describe('h inference w/ Teleport', () => {
  h(Teleport, { to: '#foo' }, 'hello')
  // @ts-expect-error
  expectError(h(Teleport))
  // @ts-expect-error
  expectError(h(Teleport, {}))
  // @ts-expect-error
  expectError(h(Teleport, { to: '#foo' }))
})

describe('h inference w/ Suspense', () => {
  h(Suspense, { onRecede: () => {}, onResolve: () => {} }, 'hello')
  h(Suspense, 'foo')
  h(Suspense, () => 'foo')
  h(Suspense, null, {
    default: () => 'foo'
  })
  //  @ts-expect-error
  expectError(h(Suspense, { onResolve: 1 }))
})

describe('h inference w/ functional component', () => {
  const Func = (_props: { foo: string; bar?: number }) => ''
  h(Func, { foo: 'hello' })
  h(Func, { foo: 'hello', bar: 123 })

  //  @ts-expect-error
  expectError(h(Func, { foo: 123 }))
  //  @ts-expect-error
  expectError(h(Func, {}))
  //  @ts-expect-error
  expectError(h(Func, { bar: 123 }))

  const Func2: FunctionalComponent<{}, ['foo', 'bar']> = () => {}
  h(Func2, { onFoo() {}, onBar() {} })

  // @ts-expect-error
  h(Func2, { onFoo: 1 })
})

describe('h support w/ plain object component', () => {
  const Foo = {
    props: {
      foo: String
    }
  }
  h(Foo, { foo: 'ok' })
  h(Foo, { foo: 'ok', class: 'extra' })
  // no inference in this case

  h(
    {
      emits: {
        foo(a: number) {
          return true
        }
      }
    },
    {
      // NOTE this should at least infer `s` as number
      // ERROR caused by `RawProps`
      onFoo(s) {
        expectType<number>(s)
      }
    }
  )

  h(
    {
      props: {
        foo: String
      },
      emits: {
        foo(a: number) {
          return true
        }
      }
    },
    {
      foo: 'ss',

      // NOTE this should at least infer `s` as number
      onFoo(s) {
        expectType<number>(s)
      }
    }
  )
})

describe('h inference w/ defineComponent', () => {
  const Foo = defineComponent({
    props: {
      foo: String,
      bar: {
        type: Number,
        required: true
      }
    }
  })

  h(Foo, { bar: 1 })
  h(Foo, { bar: 1, foo: 'ok' })
  // should allow extraneous props (attrs fallthrough)
  h(Foo, { bar: 1, foo: 'ok', class: 'extra' })
  // @ts-expect-error should fail on missing required prop
  expectError(h(Foo, {}))
  //  @ts-expect-error
  expectError(h(Foo, { foo: 'ok' }))
  // @ts-expect-error should fail on wrong type
  expectError(h(Foo, { bar: 1, foo: 1 }))

  const FooEmit = defineComponent({
    emits: {
      foo(a: number) {
        return true
      }
    }
  })

  h(FooEmit, {
    // NOTE it should infer the correct argument,
    // it infers the key `onFoo` but not the argument type :thinking:
    onFoo(a) {
      expectType<number>(a)
    }
  })
})

// describe('h inference w/ defineComponent + optional props', () => {
//   const Foo = defineComponent({
//     setup(_props: { foo?: string; bar: number }) {}
//   })

//   h(Foo, { bar: 1 })
//   h(Foo, { bar: 1, foo: 'ok' })
//   // should allow extraneous props (attrs fallthrough)
//   h(Foo, { bar: 1, foo: 'ok', class: 'extra' })
//   // @ts-expect-error should fail on missing required prop
//   expectError(h(Foo, {}))
//   // @ts-expect-error
//   expectError(h(Foo, { foo: 'ok' }))
//   // @ts-expect-error should fail on wrong type
//   expectError(h(Foo, { bar: 1, foo: 1 }))
// })

// describe('h inference w/ defineComponent + direct function', () => {
//   const Foo = defineComponent((_props: { foo?: string; bar: number }) => {})

//   h(Foo, { bar: 1 })
//   h(Foo, { bar: 1, foo: 'ok' })
//   // should allow extraneous props (attrs fallthrough)
//   h(Foo, { bar: 1, foo: 'ok', class: 'extra' })
//   // @ts-expect-error should fail on missing required prop
//   expectError(h(Foo, {}))
//   //  @ts-expect-error
//   expectError(h(Foo, { foo: 'ok' }))
//   // @ts-expect-error should fail on wrong type
//   expectError(h(Foo, { bar: 1, foo: 1 }))
// })

// #922
describe('h support for generic component type', () => {
  function foo(bar: Component) {
    h(bar)
    h(bar, 'hello')
    // @ts-expect-error
    h(bar, { id: 'ok' }, 'hello')
  }
  foo({})
})

// #993
describe('describeComponent extends Component', () => {
  // functional
  expectAssignable<Component>(
    defineComponent((_props: { foo?: string; bar: number }) => {})
  )

  // typed props
  expectAssignable<Component>(defineComponent({}))

  // prop arrays
  expectAssignable<Component>(
    defineComponent({
      props: ['a', 'b']
    })
  )

  // prop object
  expectAssignable<Component>(
    defineComponent({
      props: {
        foo: String,
        bar: {
          type: Number,
          required: true
        }
      }
    })
  )
})

// #1385
describe('component w/ props w/ default value', () => {
  const MyComponent = defineComponent({
    props: {
      message: {
        type: String,
        default: 'hello'
      }
    }
  })

  h(MyComponent, {})
})
