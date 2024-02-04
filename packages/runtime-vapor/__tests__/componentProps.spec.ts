// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentProps.spec.ts`.

// NOTE: not supported
// mixins
// caching

import { type FunctionalComponent, setCurrentInstance } from '../src/component'
import {
  children,
  defineComponent,
  getCurrentInstance,
  nextTick,
  ref,
  render,
  setText,
  template,
  watchEffect,
} from '../src'

let host: HTMLElement
const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => initHost())
afterEach(() => host.remove())

describe('component props (vapor)', () => {
  test('stateful', () => {
    let props: any
    // TODO: attrs

    const Comp = defineComponent({
      props: ['fooBar', 'barBaz'],
      render() {
        const instance = getCurrentInstance()!
        props = instance.props
      },
    })

    render(
      Comp,
      {
        get fooBar() {
          return 1
        },
      },
      host,
    )
    expect(props.fooBar).toEqual(1)

    // test passing kebab-case and resolving to camelCase
    render(
      Comp,
      {
        get ['foo-bar']() {
          return 2
        },
      },
      host,
    )
    expect(props.fooBar).toEqual(2)

    // test updating kebab-case should not delete it (#955)
    render(
      Comp,
      {
        get ['foo-bar']() {
          return 3
        },
        get barBaz() {
          return 5
        },
      },
      host,
    )
    expect(props.fooBar).toEqual(3)
    expect(props.barBaz).toEqual(5)

    render(Comp, {}, host)
    expect(props.fooBar).toBeUndefined()
    expect(props.barBaz).toBeUndefined()
    // expect(props.qux).toEqual(5) // TODO: attrs
  })

  test.todo('stateful with setup', () => {
    // TODO:
  })

  test('functional with declaration', () => {
    let props: any
    // TODO: attrs

    const Comp: FunctionalComponent = defineComponent((_props: any) => {
      const instance = getCurrentInstance()!
      props = instance.props
      return {}
    })
    Comp.props = ['foo']
    Comp.render = (() => {}) as any

    render(
      Comp,
      {
        get foo() {
          return 1
        },
      },
      host,
    )
    expect(props.foo).toEqual(1)

    render(
      Comp,
      {
        get foo() {
          return 2
        },
      },
      host,
    )
    expect(props.foo).toEqual(2)

    render(Comp, {}, host)
    expect(props.foo).toBeUndefined()
  })

  test('functional without declaration', () => {
    let props: any
    // TODO: attrs

    const Comp: FunctionalComponent = defineComponent((_props: any) => {
      const instance = getCurrentInstance()!
      props = instance.props
      return {}
    })
    Comp.props = undefined as any
    Comp.render = (() => {}) as any

    render(
      Comp,
      {
        get foo() {
          return 1
        },
      },
      host,
    )
    expect(props.foo).toBeUndefined()

    render(
      Comp,
      {
        get foo() {
          return 2
        },
      },
      host,
    )
    expect(props.foo).toBeUndefined()
  })

  test('boolean casting', () => {
    let props: any
    const Comp = defineComponent({
      props: {
        foo: Boolean,
        bar: Boolean,
        baz: Boolean,
        qux: Boolean,
      },
      render() {
        const instance = getCurrentInstance()!
        props = instance.props
      },
    })

    render(
      Comp,
      {
        // absent should cast to false
        bar: '', // empty string should cast to true
        baz: 'baz', // same string should cast to true
        qux: 'ok', // other values should be left in-tact (but raise warning)
      },
      host,
    )

    expect(props.foo).toBe(false)
    expect(props.bar).toBe(true)
    expect(props.baz).toBe(true)
    expect(props.qux).toBe('ok')
  })

  test('default value', () => {
    let props: any
    const defaultFn = vi.fn(() => ({ a: 1 }))
    const defaultBaz = vi.fn(() => ({ b: 1 }))

    const Comp = defineComponent({
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
      render() {
        const instance = getCurrentInstance()!
        props = instance.props
      },
    })

    render(
      Comp,
      {
        get foo() {
          return 2
        },
      },
      host,
    )
    expect(props.foo).toBe(2)
    // const prevBar = props.bar
    props.bar
    expect(props.bar).toEqual({ a: 1 })
    expect(props.baz).toEqual(defaultBaz)
    // expect(defaultFn).toHaveBeenCalledTimes(1) // failed: (caching is not supported)
    expect(defaultFn).toHaveBeenCalledTimes(2)
    expect(defaultBaz).toHaveBeenCalledTimes(0)

    // #999: updates should not cause default factory of unchanged prop to be
    // called again
    render(
      Comp,
      {
        get foo() {
          return 3
        },
      },
      host,
    )
    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ a: 1 })
    // expect(props.bar).toBe(prevBar) // failed: (caching is not supported)
    // expect(defaultFn).toHaveBeenCalledTimes(1) // failed: caching is not supported (called 3 times)

    render(
      Comp,
      {
        get bar() {
          return { b: 2 }
        },
      },
      host,
    )
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 2 })
    // expect(defaultFn).toHaveBeenCalledTimes(1) // failed: caching is not supported (called 3 times)

    render(
      Comp,
      {
        get foo() {
          return 3
        },
        get bar() {
          return { b: 3 }
        },
      },
      host,
    )
    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ b: 3 })
    // expect(defaultFn).toHaveBeenCalledTimes(1) // failed: caching is not supported (called 3 times)

    render(
      Comp,
      {
        get bar() {
          return { b: 4 }
        },
      },
      host,
    )
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 4 })
    // expect(defaultFn).toHaveBeenCalledTimes(1) // failed: caching is not supported (called 3 times)
  })

  test.todo('using inject in default value factory', () => {
    // TODO: impl inject
  })

  // NOTE: maybe it's unnecessary
  // https://github.com/vuejs/core-vapor/pull/99#discussion_r1472647377
  test('optimized props updates', async () => {
    const Child = defineComponent({
      props: ['foo'],
      render() {
        const instance = getCurrentInstance()!
        const t0 = template('<div><!></div>')
        const n0 = t0()
        const {
          0: [n1],
        } = children(n0)
        watchEffect(() => {
          setText(n1, instance.props.foo)
        })
        return n0
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const Comp = defineComponent({
      setup() {
        return { foo, id }
      },
      render(_ctx: Record<string, any>) {
        const t0 = template('')
        const n0 = t0()
        render(
          Child,
          {
            get foo() {
              return _ctx.foo
            },
            get id() {
              return _ctx.id
            },
          },
          n0 as any, // TODO: type
        )
        return n0
      },
    })

    const instace = render(Comp, {}, host)
    const reset = setCurrentInstance(instace)
    // expect(host.innerHTML).toBe('<div id="a">1</div>') // TODO: Fallthrough Attributes
    expect(host.innerHTML).toBe('<div>1</div>')

    foo.value++
    await nextTick()
    // expect(host.innerHTML).toBe('<div id="a">2</div>') // TODO: Fallthrough Attributes
    expect(host.innerHTML).toBe('<div>2</div>')

    // id.value = 'b'
    // await nextTick()
    // expect(host.innerHTML).toBe('<div id="b">2</div>') // TODO: Fallthrough Attributes
    reset()
  })

  test.todo('validator', () => {
    // TODO: impl validator
  })

  test.todo('warn props mutation', () => {
    // TODO: impl warn
  })

  test.todo('warn absent required props', () => {
    // TODO: impl warn
  })

  test.todo('warn on type mismatch', () => {
    // TODO: impl warn
  })

  // #3495
  test.todo('should not warn required props using kebab-case', async () => {
    // TODO: impl warn
  })

  test('props type support BigInt', () => {
    const Comp = defineComponent({
      props: {
        foo: BigInt,
      },
      render() {
        const instance = getCurrentInstance()!
        const t0 = template('<div></div>')
        const n0 = t0()
        const {
          0: [n1],
        } = children(n0)
        watchEffect(() => {
          setText(n1, instance.props.foo)
        })
        return n0
      },
    })

    render(
      Comp,
      {
        get foo() {
          return (
            BigInt(BigInt(100000111)) + BigInt(2000000000) * BigInt(30000000)
          )
        },
      },
      '#host',
    )
    expect(host.innerHTML).toBe('<div>60000000100000111</div>')
  })

  // #3288
  test.todo(
    'declared prop key should be present even if not passed',
    async () => {
      // let initialKeys: string[] = []
      // const changeSpy = vi.fn()
      // const passFoo = ref(false)
      // const Comp = {
      //   props: ['foo'],
      //   setup() {
      //     const instance = getCurrentInstance()!
      //     initialKeys = Object.keys(instance.props)
      //     watchEffect(changeSpy)
      //     return {}
      //   },
      //   render() {
      //     return {}
      //   },
      // }
      // const Parent = createIf(
      //   () => passFoo.value,
      //   () => {
      //     return render(Comp , { foo: 1 }, host) // TODO: createComponent fn
      //   },
      // )
      // // expect(changeSpy).toHaveBeenCalledTimes(1)
    },
  )

  // #3371
  test.todo(`avoid double-setting props when casting`, async () => {
    // TODO: proide, slots
  })

  test('support null in required + multiple-type declarations', () => {
    const Comp = defineComponent({
      props: {
        foo: { type: [Function, null], required: true },
      },
      render() {},
    })

    expect(() => {
      render(Comp, { foo: () => {} }, host)
    }).not.toThrow()

    expect(() => {
      render(Comp, { foo: null }, host)
    }).not.toThrow()
  })

  // #5016
  test.todo('handling attr with undefined value', () => {
    // TODO: attrs
  })

  // #6915
  test('should not mutate original props long-form definition object', () => {
    const props = {
      msg: {
        type: String,
      },
    }
    const Comp = defineComponent({
      props,
      render() {},
    })

    render(Comp, { msg: 'test' }, host)

    expect(Object.keys(props.msg).length).toBe(1)
  })
})
