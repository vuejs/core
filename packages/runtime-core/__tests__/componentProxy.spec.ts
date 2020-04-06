import {
  h,
  render,
  getCurrentInstance,
  nodeOps,
  createApp
} from '@vue/runtime-test'
import { mockWarn } from '@vue/shared'
import { ComponentInternalInstance } from '../src/component'

describe('component: proxy', () => {
  mockWarn()

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

  test('renderContext', () => {
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
    expect(instance!.renderContext.foo).toBe(2)
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

  test('public properties', () => {
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
    expect(instanceProxy.$props).toBe(instance!.props)
    expect(instanceProxy.$attrs).toBe(instance!.attrs)
    expect(instanceProxy.$slots).toBe(instance!.slots)
    expect(instanceProxy.$refs).toBe(instance!.refs)
    expect(instanceProxy.$parent).toBe(
      instance!.parent && instance!.parent.proxy
    )
    expect(instanceProxy.$root).toBe(instance!.root.proxy)
    expect(instanceProxy.$emit).toBe(instance!.emit)
    expect(instanceProxy.$el).toBe(instance!.vnode.el)
    expect(instanceProxy.$options).toBe(instance!.type)
    expect(() => (instanceProxy.$data = {})).toThrow(TypeError)
    expect(`Attempting to mutate public property "$data"`).toHaveBeenWarned()
  })

  test('sink', async () => {
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
    expect(instance!.sink.foo).toBe(1)
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
    expect(instanceProxy.foo).toBe(2)
    expect(instance!.sink.foo).toBe(2)
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
    // renderContext
    expect('bar' in instanceProxy).toBe(true)
    // public properties
    expect('$el' in instanceProxy).toBe(true)
    // global properties
    expect('global' in instanceProxy).toBe(true)

    // non-existent
    expect('$foobar' in instanceProxy).toBe(false)
    expect('baz' in instanceProxy).toBe(false)

    // set non-existent (goes into sink)
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
})
