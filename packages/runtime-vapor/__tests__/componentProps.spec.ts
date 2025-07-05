// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentProps.spec.ts`.

import {
  // currentInstance,
  inject,
  nextTick,
  provide,
  ref,
  toRefs,
  watch,
} from '@vue/runtime-dom'
import {
  createComponent,
  defineVaporComponent,
  renderEffect,
  template,
} from '../src'
import { makeRender } from './_utils'
import { setElementText } from '../src/dom/prop'

const define = makeRender<any>()

describe('component: props', () => {
  test('stateful', () => {
    let props: any
    let attrs: any

    const { render } = define({
      props: ['fooBar', 'barBaz'],
      setup(_props: any, { attrs: _attrs }: any) {
        props = _props
        attrs = _attrs
        return []
      },
    })

    render({ fooBar: () => 1, bar: () => 2 })
    expect(props).toEqual({ fooBar: 1 })
    expect(attrs).toEqual({ bar: 2 })

    // test passing kebab-case and resolving to camelCase
    render({ 'foo-bar': () => 2, bar: () => 3, baz: () => 4 })
    expect(props).toEqual({ fooBar: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    // test updating kebab-case should not delete it (#955)
    render({ 'foo-bar': () => 3, bar: () => 3, baz: () => 4, barBaz: () => 5 })
    expect(props).toEqual({ fooBar: 3, barBaz: 5 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    // remove the props with camelCase key (#1412)
    render({ qux: () => 5 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('stateful with setup', () => {
    let props: any
    let attrs: any

    const { render } = define({
      props: ['foo'],
      setup(_props: any, { attrs: _attrs }: any) {
        props = _props
        attrs = _attrs
        return []
      },
    })

    render({ foo: () => 1, bar: () => 2 })
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ bar: 2 })

    render({ foo: () => 2, bar: () => 3, baz: () => 4 })
    expect(props).toEqual({ foo: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render({ qux: () => 5 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('functional with declaration', () => {
    let props: any
    let attrs: any

    const { component: Comp, render } = define(
      (_props: any, { attrs: _attrs }: any) => {
        props = _props
        attrs = _attrs
        return []
      },
    )
    Comp.props = ['foo']

    render({ foo: () => 1, bar: () => 2 })
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ bar: 2 })

    render({ foo: () => 2, bar: () => 3, baz: () => 4 })
    expect(props).toEqual({ foo: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render({ qux: () => 5 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('functional without declaration', () => {
    let props: any
    let attrs: any

    const { render } = define((_props: any, { attrs: _attrs }: any) => {
      props = _props
      attrs = _attrs
      return []
    })

    render({ foo: () => 1 })
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ foo: 1 })
    expect(props).toBe(attrs)

    render({ bar: () => 2 })
    expect(props).toEqual({ bar: 2 })
    expect(attrs).toEqual({ bar: 2 })
    expect(props).toBe(attrs)
  })

  test('functional defineVaporComponent without declaration', () => {
    let props: any
    let attrs: any

    const { render } = define(
      defineVaporComponent((_props: any, { attrs: _attrs }: any) => {
        props = _props
        attrs = _attrs
        return []
      }),
    )

    render({ foo: () => 1 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ foo: 1 })

    render({ bar: () => 2 })
    expect(props).toEqual({})
    expect(attrs).toEqual({ bar: 2 })
  })

  test('boolean casting', () => {
    let props: any
    const { render } = define({
      props: {
        foo: Boolean,
        bar: Boolean,
        baz: Boolean,
        qux: Boolean,
      },
      setup(_props: any) {
        props = _props
        return []
      },
    })

    render({
      // absent should cast to false
      bar: () => '', // empty string should cast to true
      baz: () => 'baz', // same string should cast to true
      qux: () => 'ok', // other values should be left in-tact (but raise warning)
    })

    expect(props.foo).toBe(false)
    expect(props.bar).toBe(true)
    expect(props.baz).toBe(true)
    expect(props.qux).toBe('ok')
    expect('type check failed for prop "qux"').toHaveBeenWarned()
  })

  test('default value', () => {
    let props: any
    const defaultFn = vi.fn(() => ({ a: 1 }))
    const defaultBaz = vi.fn(() => ({ b: 1 }))

    const { render } = define({
      props: {
        foo: {
          default: 1,
        },
        bar: {
          default: defaultFn,
        },
        baz: {
          type: Function,
          default: defaultBaz,
        },
      },
      setup(_props: any) {
        props = _props
        return []
      },
    })

    render({ foo: () => 2 })
    expect(props.foo).toBe(2)
    expect(props.bar).toEqual({ a: 1 })
    expect(props.baz).toEqual(defaultBaz)
    expect(defaultFn).toHaveBeenCalledTimes(1)
    expect(defaultBaz).toHaveBeenCalledTimes(0)

    // #999: updates should not cause default factory of unchanged prop to be
    // called again
    render({ foo: () => 3 })

    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ a: 1 })

    render({ bar: () => ({ b: 2 }) })
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 2 })

    render({
      foo: () => 3,
      bar: () => ({ b: 3 }),
    })
    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ b: 3 })

    render({ bar: () => ({ b: 4 }) })
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 4 })
  })

  test('using inject in default value factory', () => {
    let props: any

    const Child = defineVaporComponent({
      props: {
        test: {
          default: () => inject('test', 'default'),
        },
      },
      setup(_props) {
        props = _props
        return []
      },
    })

    const { render } = define({
      setup() {
        provide('test', 'injected')
        return createComponent(Child)
      },
    })

    render()

    expect(props.test).toBe('injected')
  })

  test('optimized props updates', async () => {
    const t0 = template('<div>')
    const { component: Child } = define({
      props: ['foo'],
      setup(props: any) {
        const n0 = t0()
        renderEffect(() => setElementText(n0, props.foo))
        return n0
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { host } = define({
      setup() {
        return { foo, id }
      },
      render(_ctx: Record<string, any>) {
        return createComponent(
          Child,
          {
            foo: () => _ctx.foo,
            id: () => _ctx.id,
          },
          null,
          true,
        )
      },
    }).render()
    expect(host.innerHTML).toBe('<div id="a">1</div>')

    foo.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div id="a">2</div>')

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div id="b">2</div>')
  })

  describe('validator', () => {
    test('validator should be called with two arguments', () => {
      const mockFn = vi.fn((...args: any[]) => true)
      const props = {
        foo: () => 1,
        bar: () => 2,
      }

      const t0 = template('<div/>')
      define({
        props: {
          foo: {
            type: Number,
            validator: (value: any, props: any) => mockFn(value, props),
          },
          bar: {
            type: Number,
          },
        },
        setup() {
          return t0()
        },
      }).render(props)

      expect(mockFn).toHaveBeenCalledWith(1, { foo: 1, bar: 2 })
    })

    test('validator should not be able to mutate other props', async () => {
      const mockFn = vi.fn((...args: any[]) => true)
      define({
        props: {
          foo: {
            type: Number,
            validator: (value: any, props: any) => !!(props.bar = 1),
          },
          bar: {
            type: Number,
            validator: (value: any) => mockFn(value),
          },
        },
        setup() {
          const t0 = template('<div/>')
          const n0 = t0()
          return n0
        },
      }).render!({
        foo() {
          return 1
        },
        bar() {
          return 2
        },
      })

      expect(
        `Set operation on key "bar" failed: target is readonly.`,
      ).toHaveBeenWarnedLast()
      expect(mockFn).toHaveBeenCalledWith(2)
    })
  })

  test('warn props mutation', () => {
    let props: any
    const { render } = define({
      props: ['foo'],
      setup(_props: any) {
        props = _props
        return []
      },
    })
    render({ foo: () => 1 })
    expect(props.foo).toBe(1)

    props.foo = 2
    expect(`Attempt to mutate prop "foo" failed`).toHaveBeenWarned()
  })

  test('warn absent required props', () => {
    define({
      props: {
        bool: { type: Boolean, required: true },
        str: { type: String, required: true },
        num: { type: Number, required: true },
      },
      setup() {
        return []
      },
    }).render()
    expect(`Missing required prop: "bool"`).toHaveBeenWarned()
    expect(`Missing required prop: "str"`).toHaveBeenWarned()
    expect(`Missing required prop: "num"`).toHaveBeenWarned()
  })

  // NOTE: type check is not supported in vapor
  // test('warn on type mismatch', () => {})

  // #3495
  test('should not warn required props using kebab-case', async () => {
    define({
      props: {
        fooBar: { type: String, required: true },
      },
      setup() {
        return []
      },
    }).render({
      ['foo-bar']: () => 'hello',
    })
    expect(`Missing required prop: "fooBar"`).not.toHaveBeenWarned()
  })

  test('props type support BigInt', () => {
    const t0 = template('<div>')
    const { host } = define({
      props: {
        foo: BigInt,
      },
      setup(props: any) {
        const n0 = t0()
        renderEffect(() => setElementText(n0, props.foo))
        return n0
      },
    }).render({
      foo: () =>
        BigInt(BigInt(100000111)) + BigInt(2000000000) * BigInt(30000000),
    })
    expect(host.innerHTML).toBe('<div>60000000100000111</div>')
  })

  // #3474
  test('should cache the value returned from the default factory to avoid unnecessary watcher trigger', async () => {
    let count = 0

    const { render, html } = define({
      props: {
        foo: {
          type: Object,
          default: () => ({ val: 1 }),
        },
        bar: Number,
      },
      setup(props: any) {
        watch(
          () => props.foo,
          () => {
            count++
          },
        )
        const t0 = template('<h1></h1>')
        const n0 = t0()
        renderEffect(() => {
          setElementText(n0, String(props.foo.val) + String(props.bar))
        })
        return n0
      },
    })

    const foo = ref()
    const bar = ref(0)
    render({ foo: () => foo.value, bar: () => bar.value })
    expect(html()).toBe(`<h1>10</h1>`)
    expect(count).toBe(0)

    bar.value++
    await nextTick()
    expect(html()).toBe(`<h1>11</h1>`)
    expect(count).toBe(0)
  })

  // #3288
  test('declared prop key should be present even if not passed', async () => {
    let initialKeys: string[] = []
    const changeSpy = vi.fn()
    const passFoo = ref(false)

    const Comp: any = {
      props: {
        foo: String,
      },
      setup(props: any) {
        initialKeys = Object.keys(props)
        const { foo } = toRefs(props)
        watch(foo, changeSpy)
        return []
      },
    }

    define(() =>
      createComponent(Comp, {
        $: [() => (passFoo.value ? { foo: 'ok' } : {})],
      }),
    ).render()

    expect(initialKeys).toMatchObject(['foo'])
    passFoo.value = true
    await nextTick()
    expect(changeSpy).toHaveBeenCalledTimes(1)
  })

  test('should not warn invalid watch source when directly watching props', async () => {
    const changeSpy = vi.fn()
    const { render, html } = define({
      props: {
        foo: {
          type: String,
        },
      },
      setup(props: any) {
        watch(props, changeSpy)
        const t0 = template('<h1></h1>')
        const n0 = t0()
        renderEffect(() => {
          setElementText(n0, String(props.foo))
        })
        return n0
      },
    })

    const foo = ref('foo')
    render({ foo: () => foo.value })
    expect(html()).toBe(`<h1>foo</h1>`)
    expect('Invalid watch source').not.toHaveBeenWarned()

    foo.value = 'bar'
    await nextTick()
    expect(html()).toBe(`<h1>bar</h1>`)
    expect(changeSpy).toHaveBeenCalledTimes(1)
  })

  test('support null in required + multiple-type declarations', () => {
    const { render } = define({
      props: {
        foo: { type: [Function, null], required: true },
      },
      setup() {
        return []
      },
    })

    expect(() => {
      render({ foo: () => () => {} })
    }).not.toThrow()

    expect(() => {
      render({ foo: () => null })
    }).not.toThrow()
  })

  // #5016
  test('handling attr with undefined value', () => {
    const { render, host } = define({
      inheritAttrs: false,
      setup(_: any, { attrs }: any) {
        const t0 = template('<div></div>')
        const n0 = t0()
        renderEffect(() =>
          setElementText(n0, JSON.stringify(attrs) + Object.keys(attrs)),
        )
        return n0
      },
    })

    const attrs: any = { foo: () => undefined }
    render(attrs)

    expect(host.innerHTML).toBe(
      `<div>${JSON.stringify(attrs) + Object.keys(attrs)}</div>`,
    )
  })

  // #6915
  test('should not mutate original props long-form definition object', () => {
    const props = {
      msg: {
        type: String,
      },
    }
    define({ props, setup: () => [] }).render({ msg: () => 'test' })

    expect(Object.keys(props.msg).length).toBe(1)
  })

  test('should warn against reserved prop names', () => {
    const { render } = define({
      props: {
        $foo: String,
      },
      setup: () => [],
    })

    render({ msg: () => 'test' })
    expect(`Invalid prop name: "$foo"`).toHaveBeenWarned()
  })
})
