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
import { makeRender } from './_utils'

const define = makeRender<any>()

describe('component props (vapor)', () => {
  test('stateful', () => {
    let props: any
    // TODO: attrs

    const { render } = define({
      props: ['fooBar', 'barBaz'],
      render() {
        const instance = getCurrentInstance()!
        props = instance.props
      },
    })

    render({
      get fooBar() {
        return 1
      },
    })
    expect(props.fooBar).toEqual(1)

    // test passing kebab-case and resolving to camelCase
    render({
      get ['foo-bar']() {
        return 2
      },
    })
    expect(props.fooBar).toEqual(2)

    // test updating kebab-case should not delete it (#955)
    render({
      get ['foo-bar']() {
        return 3
      },
      get barBaz() {
        return 5
      },
    })
    expect(props.fooBar).toEqual(3)
    expect(props.barBaz).toEqual(5)

    render({})
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

    const { component: Comp, render } = define((_props: any) => {
      const instance = getCurrentInstance()!
      props = instance.props
      return {}
    })
    Comp.props = ['foo']
    Comp.render = (() => {}) as any

    render({
      get foo() {
        return 1
      },
    })
    expect(props.foo).toEqual(1)

    render({
      get foo() {
        return 2
      },
    })
    expect(props.foo).toEqual(2)

    render({})
    expect(props.foo).toBeUndefined()
  })

  test('functional without declaration', () => {
    let props: any
    // TODO: attrs

    const { component: Comp, render } = define((_props: any) => {
      const instance = getCurrentInstance()!
      props = instance.props
      return {}
    })
    Comp.props = undefined as any
    Comp.render = (() => {}) as any

    render({
      get foo() {
        return 1
      },
    })
    expect(props.foo).toBeUndefined()

    render({
      get foo() {
        return 2
      },
    })
    expect(props.foo).toBeUndefined()
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
      render() {
        const instance = getCurrentInstance()!
        props = instance.props
      },
    })

    render({
      // absent should cast to false
      bar: '', // empty string should cast to true
      baz: 'baz', // same string should cast to true
      qux: 'ok', // other values should be left in-tact (but raise warning)
    })

    expect(props.foo).toBe(false)
    expect(props.bar).toBe(true)
    expect(props.baz).toBe(true)
    expect(props.qux).toBe('ok')
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
      render() {
        const instance = getCurrentInstance()!
        props = instance.props
      },
    })

    render({
      get foo() {
        return 2
      },
    })
    expect(props.foo).toBe(2)
    // const prevBar = props.bar
    props.bar
    expect(props.bar).toEqual({ a: 1 })
    expect(props.baz).toEqual(defaultBaz)
    // expect(defaultFn).toHaveBeenCalledTimes(1) // failed: (caching is not supported)
    expect(defaultFn).toHaveBeenCalledTimes(3)
    expect(defaultBaz).toHaveBeenCalledTimes(0)

    // #999: updates should not cause default factory of unchanged prop to be
    // called again
    render({
      get foo() {
        return 3
      },
    })
    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ a: 1 })
    // expect(props.bar).toBe(prevBar) // failed: (caching is not supported)
    // expect(defaultFn).toHaveBeenCalledTimes(1) // failed: caching is not supported (called 3 times)

    render({
      get bar() {
        return { b: 2 }
      },
    })
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 2 })
    // expect(defaultFn).toHaveBeenCalledTimes(1) // failed: caching is not supported (called 3 times)

    render({
      get foo() {
        return 3
      },
      get bar() {
        return { b: 3 }
      },
    })
    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ b: 3 })
    // expect(defaultFn).toHaveBeenCalledTimes(1) // failed: caching is not supported (called 3 times)

    render({
      get bar() {
        return { b: 4 }
      },
    })
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
    const renderChild = define({
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
    }).render

    const foo = ref(1)
    const id = ref('a')
    const { instance, host } = define({
      setup() {
        return { foo, id }
      },
      render(_ctx: Record<string, any>) {
        const t0 = template('')
        const n0 = t0()
        renderChild(
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
    }).render()
    const reset = setCurrentInstance(instance)
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

  describe('validator', () => {
    test('validator should be called with two arguments', () => {
      let args: any
      const mockFn = vi.fn((..._args: any[]) => {
        args = _args
        return true
      })

      const props = {
        get foo() {
          return 1
        },
        get bar() {
          return 2
        },
      }

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
        render() {
          const t0 = template('<div/>')
          const n0 = t0()
          return n0
        },
      }).render(props)

      expect(mockFn).toHaveBeenCalled()
      // NOTE: Vapor Component props defined by getter. So, `props` not Equal to `{ foo: 1, bar: 2 }`
      // expect(mockFn).toHaveBeenCalledWith(1, { foo: 1, bar: 2 })
      expect(args.length).toBe(2)
      expect(args[0]).toBe(1)
      expect(args[1].foo).toEqual(1)
      expect(args[1].bar).toEqual(2)
    })

    // TODO: impl setter and warnner
    test.todo(
      'validator should not be able to mutate other props',
      async () => {
        const mockFn = vi.fn((...args: any[]) => true)
        defineComponent({
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
          render() {
            const t0 = template('<div/>')
            const n0 = t0()
            return n0
          },
        }).render({
          get foo() {
            return 1
          },
          get bar() {
            return 2
          },
        })

        expect(
          `Set operation on key "bar" failed: target is readonly.`,
        ).toHaveBeenWarnedLast()
        expect(mockFn).toHaveBeenCalledWith(2)
      },
    )
  })

  test.todo('warn props mutation', () => {
    // TODO: impl warn
  })

  test('warn absent required props', () => {
    define({
      props: {
        bool: { type: Boolean, required: true },
        str: { type: String, required: true },
        num: { type: Number, required: true },
      },
      setup() {
        return () => null
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
        return () => null
      },
    }).render({
      get ['foo-bar']() {
        return 'hello'
      },
    })
    expect(`Missing required prop: "fooBar"`).not.toHaveBeenWarned()
  })

  test('props type support BigInt', () => {
    const { host } = define({
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
    }).render({
      get foo() {
        return BigInt(BigInt(100000111)) + BigInt(2000000000) * BigInt(30000000)
      },
    })
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
    const { render } = define({
      props: {
        foo: { type: [Function, null], required: true },
      },
      render() {},
    })

    expect(() => {
      render({ foo: () => {} })
    }).not.toThrow()

    expect(() => {
      render({ foo: null })
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
    define({ props, render() {} }).render({ msg: 'test' })

    expect(Object.keys(props.msg).length).toBe(1)
  })
})
