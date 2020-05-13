import {
  ComponentInternalInstance,
  getCurrentInstance,
  render,
  h,
  nodeOps,
  FunctionalComponent,
  defineComponent,
  ref
} from '@vue/runtime-test'
import { render as domRender, nextTick } from 'vue'
import { mockWarn } from '@vue/shared'

describe('component props', () => {
  mockWarn()

  test('stateful', () => {
    let props: any
    let attrs: any
    let proxy: any

    const Comp = defineComponent({
      props: ['fooBar'],
      render() {
        props = this.$props
        attrs = this.$attrs
        proxy = this
      }
    })

    const root = nodeOps.createElement('div')
    render(h(Comp, { fooBar: 1, bar: 2 }), root)
    expect(proxy.fooBar).toBe(1)
    expect(props).toEqual({ fooBar: 1 })
    expect(attrs).toEqual({ bar: 2 })

    // test passing kebab-case and resolving to camelCase
    render(h(Comp, { 'foo-bar': 2, bar: 3, baz: 4 }), root)
    expect(proxy.fooBar).toBe(2)
    expect(props).toEqual({ fooBar: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    // test updating kebab-case should not delete it (#955)
    render(h(Comp, { 'foo-bar': 3, bar: 3, baz: 4 }), root)
    expect(proxy.fooBar).toBe(3)
    expect(props).toEqual({ fooBar: 3 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render(h(Comp, { qux: 5 }), root)
    expect(proxy.fooBar).toBeUndefined()
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('stateful with setup', () => {
    let props: any
    let attrs: any

    const Comp = defineComponent({
      props: ['foo'],
      setup(_props, { attrs: _attrs }) {
        return () => {
          props = _props
          attrs = _attrs
        }
      }
    })

    const root = nodeOps.createElement('div')
    render(h(Comp, { foo: 1, bar: 2 }), root)
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ bar: 2 })

    render(h(Comp, { foo: 2, bar: 3, baz: 4 }), root)
    expect(props).toEqual({ foo: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render(h(Comp, { qux: 5 }), root)
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('functional with declaration', () => {
    let props: any
    let attrs: any

    const Comp: FunctionalComponent = (_props, { attrs: _attrs }) => {
      props = _props
      attrs = _attrs
    }
    Comp.props = ['foo']

    const root = nodeOps.createElement('div')
    render(h(Comp, { foo: 1, bar: 2 }), root)
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ bar: 2 })

    render(h(Comp, { foo: 2, bar: 3, baz: 4 }), root)
    expect(props).toEqual({ foo: 2 })
    expect(attrs).toEqual({ bar: 3, baz: 4 })

    render(h(Comp, { qux: 5 }), root)
    expect(props).toEqual({})
    expect(attrs).toEqual({ qux: 5 })
  })

  test('functional without declaration', () => {
    let props: any
    let attrs: any
    const Comp: FunctionalComponent = (_props, { attrs: _attrs }) => {
      props = _props
      attrs = _attrs
    }
    const root = nodeOps.createElement('div')

    render(h(Comp, { foo: 1 }), root)
    expect(props).toEqual({ foo: 1 })
    expect(attrs).toEqual({ foo: 1 })
    expect(props).toBe(attrs)

    render(h(Comp, { bar: 2 }), root)
    expect(props).toEqual({ bar: 2 })
    expect(attrs).toEqual({ bar: 2 })
    expect(props).toBe(attrs)
  })

  test('boolean casting', () => {
    let proxy: any
    const Comp = {
      props: {
        foo: Boolean,
        bar: Boolean,
        baz: Boolean,
        qux: Boolean
      },
      render() {
        proxy = this
      }
    }
    render(
      h(Comp, {
        // absent should cast to false
        bar: '', // empty string should cast to true
        baz: 'baz', // same string should cast to true
        qux: 'ok' // other values should be left in-tact (but raise warning)
      }),
      nodeOps.createElement('div')
    )

    expect(proxy.foo).toBe(false)
    expect(proxy.bar).toBe(true)
    expect(proxy.baz).toBe(true)
    expect(proxy.qux).toBe('ok')
    expect('type check failed for prop "qux"').toHaveBeenWarned()
  })

  test('default value', () => {
    let proxy: any
    const defaultFn = jest.fn(() => ({ a: 1 }))

    const Comp = {
      props: {
        foo: {
          default: 1
        },
        bar: {
          default: defaultFn
        }
      },
      render() {
        proxy = this
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp, { foo: 2 }), root)
    expect(proxy.foo).toBe(2)
    const prevBar = proxy.bar
    expect(proxy.bar).toEqual({ a: 1 })
    expect(defaultFn).toHaveBeenCalledTimes(1)

    // #999: updates should not cause default factory of unchanged prop to be
    // called again
    render(h(Comp, { foo: 3 }), root)
    expect(proxy.foo).toBe(3)
    expect(proxy.bar).toEqual({ a: 1 })
    expect(proxy.bar).toBe(prevBar)
    expect(defaultFn).toHaveBeenCalledTimes(1)

    render(h(Comp, { bar: { b: 2 } }), root)
    expect(proxy.foo).toBe(1)
    expect(proxy.bar).toEqual({ b: 2 })
    expect(defaultFn).toHaveBeenCalledTimes(1)

    render(h(Comp, { foo: 3, bar: { b: 3 } }), root)
    expect(proxy.foo).toBe(3)
    expect(proxy.bar).toEqual({ b: 3 })
    expect(defaultFn).toHaveBeenCalledTimes(1)

    render(h(Comp, { bar: { b: 4 } }), root)
    expect(proxy.foo).toBe(1)
    expect(proxy.bar).toEqual({ b: 4 })
    expect(defaultFn).toHaveBeenCalledTimes(1)
  })

  test('optimized props updates', async () => {
    const Child = defineComponent({
      props: ['foo'],
      template: `<div>{{ foo }}</div>`
    })

    const foo = ref(1)
    const id = ref('a')

    const Comp = defineComponent({
      setup() {
        return {
          foo,
          id
        }
      },
      components: { Child },
      template: `<Child :foo="foo" :id="id"/>`
    })

    // Note this one is using the main Vue render so it can compile template
    // on the fly
    const root = document.createElement('div')
    domRender(h(Comp), root)
    expect(root.innerHTML).toBe('<div id="a">1</div>')

    foo.value++
    await nextTick()
    expect(root.innerHTML).toBe('<div id="a">2</div>')

    id.value = 'b'
    await nextTick()
    expect(root.innerHTML).toBe('<div id="b">2</div>')
  })

  test('warn props mutation', () => {
    let instance: ComponentInternalInstance
    let setupProps: any
    const Comp = {
      props: ['foo'],
      setup(props: any) {
        instance = getCurrentInstance()!
        setupProps = props
        return () => null
      }
    }
    render(h(Comp, { foo: 1 }), nodeOps.createElement('div'))
    expect(setupProps.foo).toBe(1)
    expect(instance!.props.foo).toBe(1)
    setupProps.foo = 2
    expect(`Set operation on key "foo" failed`).toHaveBeenWarned()
    expect(() => {
      ;(instance!.proxy as any).foo = 2
    }).toThrow(TypeError)
    expect(`Attempting to mutate prop "foo"`).toHaveBeenWarned()
  })
})
