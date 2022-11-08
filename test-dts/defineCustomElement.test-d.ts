import { defineCustomElement, expectType, expectError } from './index'

describe('inject', () => {
  // with object inject
  defineCustomElement({
    props: {
      a: String
    },
    inject: {
      foo: 'foo',
      bar: 'bar',
    },
    created() {
      expectType<unknown>(this.foo)
      expectType<unknown>(this.bar)
      //  @ts-expect-error
      expectError(this.foobar = 1)
    }
  })

  // with array inject
  defineCustomElement({
    props: ['a', 'b'],
    inject: ['foo', 'bar'],
    created() {
      expectType<unknown>(this.foo)
      expectType<unknown>(this.bar)
      //  @ts-expect-error
      expectError(this.foobar = 1)
    }
  })

  // with no props
  defineCustomElement({
    inject: {
      foo: {
        from: 'pbar',
        default: 'foo'
      },
      bar: {
        from: 'pfoo',
        default: 'bar'
      },
    },
    created() {
      expectType<unknown>(this.foo)
      expectType<unknown>(this.bar)
      //  @ts-expect-error
      expectError(this.foobar = 1)
    }
  })

  // without inject
  defineCustomElement({
    props: ['a', 'b'],
    created() {
      //  @ts-expect-error
      expectError(this.foo = 1)
      //  @ts-expect-error
      expectError(this.bar = 1)
    }
  })
})