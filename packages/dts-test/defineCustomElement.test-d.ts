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
      expectError((this.foobar = 1))
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
      expectError((this.foobar = 1))
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
      expectError((this.foobar = 1))
    }
  })

  // without inject
  defineCustomElement({
    props: ['a', 'b'],
    created() {
      //  @ts-expect-error
      expectError((this.foo = 1))
      //  @ts-expect-error
      expectError((this.bar = 1))
    }
  })
})

describe('define attrs', () => {
  test('define attrs w/ object props', () => {
    type CompAttrs = {
      bar: number
      baz?: string
    }
    defineCustomElement({
      props: {
        foo: String
      },
      attrs: Object as AttrsType<CompAttrs>,
      created() {
        expectType<number>(this.$attrs.bar)
        expectType<string | undefined>(this.$attrs.baz)
      }
    })
  })

  test('define attrs w/ array props', () => {
    type CompAttrs = {
      bar: number
      baz?: string
    }
    defineCustomElement({
      props: ['foo'],
      attrs: Object as AttrsType<CompAttrs>,
      created() {
        expectType<number>(this.$attrs.bar)
        expectType<string | undefined>(this.$attrs.baz)
      }
    })
  })

  test('define attrs w/ no props', () => {
    type CompAttrs = {
      bar: number
      baz?: string
    }
    defineCustomElement({
      attrs: Object as AttrsType<CompAttrs>,
      created() {
        expectType<number>(this.$attrs.bar)
        expectType<string | undefined>(this.$attrs.baz)
      }
    })
  })

  test('define attrs w/ function component', () => {
    type CompAttrs = {
      bar: number
      baz?: string
    }
    defineCustomElement(
      (_props: { foo: string }, ctx) => {
        expectType<number>(ctx.attrs.bar)
        expectType<number>(ctx.attrs.bar)
        expectType<string | undefined>(ctx.attrs.baz)
      },
      {
        attrs: Object as AttrsType<CompAttrs>
      }
    )
  })

  test('define attrs as low priority', () => {
    type CompAttrs = {
      foo: number
    }
    defineCustomElement({
      props: {
        foo: String
      },
      attrs: Object as AttrsType<CompAttrs>,
      created() {
        // @ts-expect-error
        console.log(this.$attrs.foo)
      }
    })
  })
})
