import {
  type VueElementConstructor,
  defineComponent,
  defineCustomElement,
} from 'vue'
import { describe, expectType, test } from './utils'

describe('inject', () => {
  // with object inject
  defineCustomElement({
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
  defineCustomElement({
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
  defineCustomElement({
    inject: {
      foo: {
        from: 'pbar',
        default: 'foo',
      },
      bar: {
        from: 'pfoo',
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
  defineCustomElement({
    props: ['a', 'b'],
    created() {
      //  @ts-expect-error
      this.foo = 1
      //  @ts-expect-error
      this.bar = 1
    },
  })
})

describe('defineCustomElement using defineComponent return type', () => {
  test('with emits', () => {
    const Comp1Vue = defineComponent({
      props: {
        a: String,
      },
      emits: {
        click: () => true,
      },
    })
    const Comp = defineCustomElement(Comp1Vue)
    expectType<VueElementConstructor>(Comp)

    expectType<string | undefined>(new Comp().a)
  })
})
