import {
  h,
  render,
  getCurrentInstance,
  nodeOps,
  createApp,
  shallowReadonly
} from '@vue/runtime-test'
import { ComponentInternalInstance, ComponentOptions } from '../src/component'

describe('component: proxy', () => {
  test('data', () => {
    let instance: ComponentInternalInstance
    let instanceProxy: any
    const Comp = {
      data() {
        return {
          foo: 1
        }
      },
      mounted() {
        instance = getCurrentInstance()!
        instanceProxy = this
      },
      render() {
        return null
      }
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(instanceProxy.foo).toBe(1)
    instanceProxy.foo = 2
    expect(instance!.data.foo).toBe(2)
  })

  test('setupState', () => {
    let instance: ComponentInternalInstance
    let instanceProxy: any
    const Comp = {
      setup() {
        return {
          foo: 1
        }
      },
      mounted() {
        instance = getCurrentInstance()!
        instanceProxy = this
      },
      render() {
        return null
      }
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(instanceProxy.foo).toBe(1)
    instanceProxy.foo = 2
    expect(instance!.setupState.foo).toBe(2)
  })

  test('should not expose non-declared props', () => {
    let instanceProxy: any
    const Comp = {
      setup() {
        return () => null
      },
      mounted() {
        instanceProxy = this
      }
    }
    render(h(Comp, { count: 1 }), nodeOps.createElement('div'))
    expect('count' in instanceProxy).toBe(false)
  })

  test('public properties', async () => {
    let instance: ComponentInternalInstance
    let instanceProxy: any
    const Comp = {
      setup() {
        return () => null
      },
      mounted() {
        instance = getCurrentInstance()!
        instanceProxy = this
      }
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(instanceProxy.$data).toBe(instance!.data)
    expect(instanceProxy.$props).toBe(shallowReadonly(instance!.props))
    expect(instanceProxy.$attrs).toBe(shallowReadonly(instance!.attrs))
    expect(instanceProxy.$slots).toBe(shallowReadonly(instance!.slots))
    expect(instanceProxy.$refs).toBe(shallowReadonly(instance!.refs))
    expect(instanceProxy.$parent).toBe(
      instance!.parent && instance!.parent.proxy
    )
    expect(instanceProxy.$root).toBe(instance!.root.proxy)
    expect(instanceProxy.$emit).toBe(instance!.emit)
    expect(instanceProxy.$el).toBe(instance!.vnode.el)
    expect(instanceProxy.$options).toBe(instance!.type as ComponentOptions)
    expect(() => (instanceProxy.$data = {})).toThrow(TypeError)
    expect(`Attempting to mutate public property "$data"`).toHaveBeenWarned()

    const nextTickThis = await instanceProxy.$nextTick(function (this: any) {
      return this
    })
    expect(nextTickThis).toBe(instanceProxy)
  })

  test('user attached properties', async () => {
    let instance: ComponentInternalInstance
    let instanceProxy: any
    const Comp = {
      setup() {
        return () => null
      },
      mounted() {
        instance = getCurrentInstance()!
        instanceProxy = this
      }
    }
    render(h(Comp), nodeOps.createElement('div'))
    instanceProxy.foo = 1
    expect(instanceProxy.foo).toBe(1)
    expect(instance!.ctx.foo).toBe(1)

    // should also allow properties that start with $
    const obj = (instanceProxy.$store = {})
    expect(instanceProxy.$store).toBe(obj)
    expect(instance!.ctx.$store).toBe(obj)
  })

  test('globalProperties', () => {
    let instance: ComponentInternalInstance
    let instanceProxy: any
    const Comp = {
      setup() {
        return () => null
      },
      mounted() {
        instance = getCurrentInstance()!
        instanceProxy = this
      }
    }

    const app = createApp(Comp)
    app.config.globalProperties.foo = 1
    app.mount(nodeOps.createElement('div'))

    expect(instanceProxy.foo).toBe(1)

    // set should overwrite globalProperties with local
    instanceProxy.foo = 2
    // expect(instanceProxy.foo).toBe(2)
    expect(instance!.ctx.foo).toBe(2)
    // should not affect global
    expect(app.config.globalProperties.foo).toBe(1)
  })

  test('has check', () => {
    let instanceProxy: any
    const Comp = {
      render() {},
      props: {
        msg: String
      },
      data() {
        return {
          foo: 0
        }
      },
      setup() {
        return {
          bar: 1
        }
      },
      mounted() {
        instanceProxy = this
      }
    }

    const app = createApp(Comp, { msg: 'hello' })
    app.config.globalProperties.global = 1

    app.mount(nodeOps.createElement('div'))

    // props
    expect('msg' in instanceProxy).toBe(true)
    // data
    expect('foo' in instanceProxy).toBe(true)
    // ctx
    expect('bar' in instanceProxy).toBe(true)
    // public properties
    expect('$el' in instanceProxy).toBe(true)
    // global properties
    expect('global' in instanceProxy).toBe(true)

    // non-existent
    expect('$foobar' in instanceProxy).toBe(false)
    expect('baz' in instanceProxy).toBe(false)

    // #4962 triggering getter should not cause non-existent property to
    // pass the has check
    instanceProxy.baz
    expect('baz' in instanceProxy).toBe(false)

    // set non-existent (goes into proxyTarget sink)
    instanceProxy.baz = 1
    expect('baz' in instanceProxy).toBe(true)

    // dev mode ownKeys check for console inspection
    // should only expose own keys
    expect(Object.keys(instanceProxy)).toMatchObject([
      'msg',
      'bar',
      'foo',
      'baz'
    ])
  })

  test('allow updating proxy with Object.defineProperty', () => {
    let instanceProxy: any
    const Comp = {
      render() {},
      setup() {
        return {
          isDisplayed: true
        }
      },
      mounted() {
        instanceProxy = this
      }
    }

    const app = createApp(Comp)

    app.mount(nodeOps.createElement('div'))

    Object.defineProperty(instanceProxy, 'isDisplayed', { value: false })

    expect(instanceProxy.isDisplayed).toBe(false)

    Object.defineProperty(instanceProxy, 'isDisplayed', { value: true })

    expect(instanceProxy.isDisplayed).toBe(true)

    Object.defineProperty(instanceProxy, 'isDisplayed', {
      get() {
        return false
      }
    })

    expect(instanceProxy.isDisplayed).toBe(false)

    Object.defineProperty(instanceProxy, 'isDisplayed', {
      get() {
        return true
      }
    })

    expect(instanceProxy.isDisplayed).toBe(true)
  })

  test('allow jest spying on proxy methods with Object.defineProperty', () => {
    // #5417
    let instanceProxy: any
    const Comp = {
      render() {},
      setup() {
        return {
          toggle() {
            return 'a'
          }
        }
      },
      mounted() {
        instanceProxy = this
      }
    }

    const app = createApp(Comp)

    app.mount(nodeOps.createElement('div'))

    // access 'toggle' to ensure key is cached
    const v1 = instanceProxy.toggle()
    expect(v1).toEqual('a')

    // reconfigure "toggle" to be getter based.
    let getCalledTimes = 0
    Object.defineProperty(instanceProxy, 'toggle', {
      get() {
        getCalledTimes++
        return () => 'b'
      }
    })

    // getter should not be evaluated on initial definition
    expect(getCalledTimes).toEqual(0)

    // invoke "toggle" after "defineProperty"
    const v2 = instanceProxy.toggle()
    expect(v2).toEqual('b')
    expect(getCalledTimes).toEqual(1)

    // expect toggle getter not to be cached. it can't be
    instanceProxy.toggle()
    expect(getCalledTimes).toEqual(2)

    // attaching jest spy, triggers the getter once, cache it and override the property.
    // also uses Object.defineProperty
    const spy = jest.spyOn(instanceProxy, 'toggle')
    expect(getCalledTimes).toEqual(3)

    // expect getter to not evaluate the jest spy caches its value
    const v3 = instanceProxy.toggle()
    expect(v3).toEqual('b')
    expect(spy).toHaveBeenCalled()
    expect(getCalledTimes).toEqual(3)
  })

  test('defineProperty on proxy property with value descriptor', () => {
    // #5417
    let instanceProxy: any
    const Comp = {
      render() {},
      setup() {
        return {
          toggle: 'a'
        }
      },
      mounted() {
        instanceProxy = this
      }
    }

    const app = createApp(Comp)

    app.mount(nodeOps.createElement('div'))

    const v1 = instanceProxy.toggle
    expect(v1).toEqual('a')

    Object.defineProperty(instanceProxy, 'toggle', {
      value: 'b'
    })
    const v2 = instanceProxy.toggle
    expect(v2).toEqual('b')

    // expect null to be a settable value
    Object.defineProperty(instanceProxy, 'toggle', {
      value: null
    })
    const v3 = instanceProxy.toggle
    expect(v3).toBeNull()
  })

  test('defineProperty on public instance proxy should work with SETUP,DATA,CONTEXT,PROPS', () => {
    // #5417
    let instanceProxy: any
    const Comp = {
      props: ['fromProp'],
      data() {
        return { name: 'data.name' }
      },
      computed: {
        greet() {
          return 'Hi ' + (this as any).name
        }
      },
      render() {},
      setup() {
        return {
          fromSetup: true
        }
      },
      mounted() {
        instanceProxy = this
      }
    }

    const app = createApp(Comp, {
      fromProp: true
    })

    app.mount(nodeOps.createElement('div'))
    expect(instanceProxy.greet).toEqual('Hi data.name')

    // define property on data
    Object.defineProperty(instanceProxy, 'name', {
      get() {
        return 'getter.name'
      }
    })

    // computed is same still cached
    expect(instanceProxy.greet).toEqual('Hi data.name')

    // trigger computed
    instanceProxy.name = ''

    // expect "greet" to evaluated and use name from context getter
    expect(instanceProxy.greet).toEqual('Hi getter.name')

    // defineProperty on computed ( context )
    Object.defineProperty(instanceProxy, 'greet', {
      get() {
        return 'Hi greet.getter.computed'
      }
    })
    expect(instanceProxy.greet).toEqual('Hi greet.getter.computed')

    // defineProperty on setupState
    expect(instanceProxy.fromSetup).toBe(true)
    Object.defineProperty(instanceProxy, 'fromSetup', {
      get() {
        return false
      }
    })
    expect(instanceProxy.fromSetup).toBe(false)

    // defineProperty on Props
    expect(instanceProxy.fromProp).toBe(true)
    Object.defineProperty(instanceProxy, 'fromProp', {
      get() {
        return false
      }
    })
    expect(instanceProxy.fromProp).toBe(false)
  })

  // #864
  test('should not warn declared but absent props', () => {
    const Comp = {
      props: ['test'],
      render(this: any) {
        return this.test
      }
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(
      `was accessed during render but is not defined`
    ).not.toHaveBeenWarned()
  })

  test('should allow symbol to access on render', () => {
    const Comp = {
      render() {
        if ((this as any)[Symbol.unscopables]) {
          return '1'
        }
        return '2'
      }
    }

    const app = createApp(Comp)
    app.mount(nodeOps.createElement('div'))

    expect(
      `Property ${JSON.stringify(
        Symbol.unscopables
      )} was accessed during render ` + `but is not defined on instance.`
    ).toHaveBeenWarned()
  })
})
