import {
  type VaporElementConstructor,
  defineVaporComponent,
  defineVaporCustomElement,
} from 'vue'
import { describe, expectType, test } from '../utils'

describe('defineVaporCustomElement using defineVaporComponent return type', () => {
  test('with object emits', () => {
    const Comp1Vapor = defineVaporComponent({
      props: {
        a: String,
      },
      emits: {
        click: () => true,
      },
    })
    const Comp = defineVaporCustomElement(Comp1Vapor)
    expectType<VaporElementConstructor>(Comp)

    const instance = new Comp()
    expectType<string | undefined>(instance.a)
    instance.a = ''
  })

  test('with array emits', () => {
    const Comp1Vapor = defineVaporComponent({
      props: {
        a: Number,
      },
      emits: ['click'],
    })
    const Comp = defineVaporCustomElement(Comp1Vapor)
    expectType<VaporElementConstructor>(Comp)

    const instance = new Comp()
    expectType<number | undefined>(instance.a)
    instance.a = 42
  })

  test('with required props', () => {
    const Comp1Vapor = defineVaporComponent({
      props: {
        a: { type: Number, required: true },
      },
    })
    const Comp = defineVaporCustomElement(Comp1Vapor)
    expectType<VaporElementConstructor>(Comp)

    const instance = new Comp()
    expectType<number>(instance.a)
    instance.a = 42
  })

  test('with default props', () => {
    const Comp1Vapor = defineVaporComponent({
      props: {
        a: {
          type: Number,
          default: 1,
          validator: () => true,
        },
      },
      emits: ['click'],
    })
    const Comp = defineVaporCustomElement(Comp1Vapor)
    expectType<VaporElementConstructor>(Comp)

    const instance = new Comp()
    expectType<number>(instance.a)
    instance.a = 42
  })

  test('with extra options', () => {
    const Comp1Vapor = defineVaporComponent({
      props: {
        a: {
          type: Number,
          default: 1,
          validator: () => true,
        },
      },
      emits: ['click'],
    })
    const Comp = defineVaporCustomElement(Comp1Vapor, {
      shadowRoot: false,
      styles: [`div { color: red; }`],
      nonce: 'xxx',
      shadowRootOptions: {
        clonable: false,
      },
      configureApp: app => {
        app.provide('a', 1)
      },
    })
    expectType<VaporElementConstructor>(Comp)

    const instance = new Comp()
    expectType<number>(instance.a)
    instance.a = 42
  })
})

describe('defineVaporCustomElement with direct setup function', () => {
  test('basic setup function', () => {
    const Comp = defineVaporCustomElement((props: { msg: string }) => {
      expectType<string>(props.msg)
      return []
    })
    expectType<VaporElementConstructor<{ msg: string }>>(Comp)

    const instance = new Comp()
    expectType<string>(instance.msg)
  })

  test('setup function with emits', () => {
    const Comp = defineVaporCustomElement(
      (props: { msg: string }, ctx) => {
        ctx.emit('foo')
        return []
      },
      {
        emits: ['foo'],
      },
    )
    expectType<VaporElementConstructor<{ msg: string }>>(Comp)

    const instance = new Comp()
    expectType<string>(instance.msg)
  })

  test('setup function with extra options', () => {
    const Comp = defineVaporCustomElement(
      (props: { msg: string }, ctx) => {
        ctx.emit('foo')
        return []
      },
      {
        name: 'Foo',
        emits: ['foo'],
        inheritAttrs: false,
        shadowRoot: false,
        styles: [`div { color: red; }`],
        nonce: 'xxx',
        shadowRootOptions: {
          clonable: false,
        },
        configureApp: app => {
          app.provide('a', 1)
        },
      },
    )
    expectType<VaporElementConstructor<{ msg: string }>>(Comp)

    const instance = new Comp()
    expectType<string>(instance.msg)
  })
})

describe('defineVaporCustomElement with options object', () => {
  test('with object props', () => {
    const Comp = defineVaporCustomElement({
      props: {
        foo: String,
        bar: {
          type: Number,
          required: true,
        },
      },
      setup(props) {
        expectType<string | undefined>(props.foo)
        expectType<number>(props.bar)
      },
    })
    expectType<VaporElementConstructor>(Comp)

    const instance = new Comp()
    expectType<string | undefined>(instance.foo)
    expectType<number>(instance.bar)
  })

  test('with array props', () => {
    const Comp = defineVaporCustomElement({
      props: ['foo', 'bar'],
      setup(props) {
        expectType<any>(props.foo)
        expectType<any>(props.bar)
      },
    })
    expectType<VaporElementConstructor>(Comp)

    const instance = new Comp()
    expectType<any>(instance.foo)
    expectType<any>(instance.bar)
  })

  test('with emits', () => {
    const Comp = defineVaporCustomElement({
      props: {
        value: String,
      },
      emits: {
        change: (val: string) => true,
      },
      setup(props, { emit }) {
        emit('change', 'test')
        // @ts-expect-error
        emit('change', 123)
        // @ts-expect-error
        emit('unknown')
      },
    })
    expectType<VaporElementConstructor>(Comp)

    const instance = new Comp()
    expectType<string | undefined>(instance.value)
  })

  test('with extra options', () => {
    const Comp = defineVaporCustomElement(
      {
        props: {
          value: String,
        },
        emits: {
          change: (val: string) => true,
        },
        setup(props, { emit }) {
          emit('change', 'test')
          // @ts-expect-error
          emit('change', 123)
          // @ts-expect-error
          emit('unknown')
        },
      },
      {
        shadowRoot: false,
        configureApp: app => {
          app.provide('a', 1)
        },
      },
    )
    expectType<VaporElementConstructor>(Comp)

    const instance = new Comp()
    expectType<string | undefined>(instance.value)
  })
})
