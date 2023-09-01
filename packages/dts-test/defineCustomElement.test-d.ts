import { defineCustomElement, AttrsType } from 'vue'
import { describe, expectType, test } from './utils'

describe('inject', () => {
  // with object inject
  defineCustomElement({
    props: {
      a: String
    },
    inject: {
      foo: 'foo',
      bar: 'bar'
    },
    created() {
      expectType<unknown>(this.foo)
      expectType<unknown>(this.bar)
      //  @ts-expect-error
      this.foobar = 1
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
      this.foobar = 1
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
      }
    },
    created() {
      expectType<unknown>(this.foo)
      expectType<unknown>(this.bar)
      //  @ts-expect-error
      this.foobar = 1
    }
  })

  // without inject
  defineCustomElement({
    props: ['a', 'b'],
    created() {
      //  @ts-expect-error
      this.foo = 1
      //  @ts-expect-error
      this.bar = 1
    }
  })
})

describe('define attrs', () => {
  test('define attrs w/ object props', () => {
    defineCustomElement({
      props: {
        foo: String
      },
      attrs: Object as AttrsType<{
        bar?: number
      }>,
      created() {
        expectType<number | undefined>(this.$attrs.bar)
      }
    })
  })

  test('define attrs w/ array props', () => {
    defineCustomElement({
      props: ['foo'],
      attrs: Object as AttrsType<{
        bar?: number
      }>,
      created() {
        expectType<number | undefined>(this.$attrs.bar)
      }
    })
  })

  test('define attrs w/ no props', () => {
    defineCustomElement({
      attrs: Object as AttrsType<{
        bar?: number
      }>,
      created() {
        expectType<number | undefined>(this.$attrs.bar)
      }
    })
  })

  test('define attrs as low priority', () => {
    defineCustomElement({
      props: {
        foo: String
      },
      attrs: Object as AttrsType<{
        foo: number
      }>,
      created() {
        // @ts-expect-error
        this.$attrs.foo
        expectType<string | undefined>(this.foo)
      }
    })
  })

  test('define attrs w/ no attrs', () => {
    defineCustomElement({
      props: {
        foo: String
      },
      created() {
        expectType<unknown>(this.$attrs.bar)
        expectType<unknown>(this.$attrs.baz)
      }
    })
  })

  test('default attrs like class, style', () => {
    defineCustomElement({
      props: {
        foo: String
      },
      created() {
        expectType<unknown>(this.$attrs.class)
        expectType<unknown>(this.$attrs.style)
      }
    })
  })

  test('define required attrs', () => {
    defineCustomElement({
      props: {
        foo: String
      },
      attrs: Object as AttrsType<{
        bar: number
      }>,
      created() {
        expectType<number>(this.$attrs.bar)
      }
    })
  })
})
