import {
  createApp,
  getCurrentInstance,
  nodeOps,
  mockWarn
} from '@vue/runtime-test'
import { ComponentInternalInstance } from '../src/component'

describe('component: proxy', () => {
  mockWarn()

  test('data', () => {
    const app = createApp()
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
    app.mount(Comp, nodeOps.createElement('div'))
    expect(instanceProxy.foo).toBe(1)
    instanceProxy.foo = 2
    expect(instance!.data.foo).toBe(2)
  })

  test('renderContext', () => {
    const app = createApp()
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
    app.mount(Comp, nodeOps.createElement('div'))
    expect(instanceProxy.foo).toBe(1)
    instanceProxy.foo = 2
    expect(instance!.renderContext.foo).toBe(2)
  })

  test('propsProxy', () => {
    const app = createApp()
    let instance: ComponentInternalInstance
    let instanceProxy: any
    const Comp = {
      props: {
        foo: {
          type: Number,
          default: 1
        }
      },
      setup() {
        return () => null
      },
      mounted() {
        instance = getCurrentInstance()!
        instanceProxy = this
      }
    }
    app.mount(Comp, nodeOps.createElement('div'))
    expect(instanceProxy.foo).toBe(1)
    expect(instance!.propsProxy!.foo).toBe(1)
    expect(() => (instanceProxy.foo = 2)).toThrow(TypeError)
    expect(`Attempting to mutate prop "foo"`).toHaveBeenWarned()
  })

  test('public properties', () => {
    const app = createApp()
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
    app.mount(Comp, nodeOps.createElement('div'))
    expect(instanceProxy.$data).toBe(instance!.data)
    expect(instanceProxy.$props).toBe(instance!.propsProxy)
    expect(instanceProxy.$attrs).toBe(instance!.attrs)
    expect(instanceProxy.$slots).toBe(instance!.slots)
    expect(instanceProxy.$refs).toBe(instance!.refs)
    expect(instanceProxy.$parent).toBe(instance!.parent)
    expect(instanceProxy.$root).toBe(instance!.root)
    expect(instanceProxy.$emit).toBe(instance!.emit)
    expect(instanceProxy.$el).toBe(instance!.vnode.el)
    expect(instanceProxy.$options).toBe(instance!.type)
    expect(() => (instanceProxy.$data = {})).toThrow(TypeError)
    expect(`Attempting to mutate public property "$data"`).toHaveBeenWarned()
  })

  test('sink', async () => {
    const app = createApp()
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
    app.mount(Comp, nodeOps.createElement('div'))
    instanceProxy.foo = 1
    expect(instanceProxy.foo).toBe(1)
    expect(instance!.sink.foo).toBe(1)
  })

  test('has check', () => {
    const app = createApp()
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
    app.mount(Comp, nodeOps.createElement('div'), { msg: 'hello' })

    // props
    expect('msg' in instanceProxy).toBe(true)
    // data
    expect('foo' in instanceProxy).toBe(true)
    // renderContext
    expect('bar' in instanceProxy).toBe(true)
    // public properties
    expect('$el' in instanceProxy).toBe(true)

    // non-existent
    expect('$foobar' in instanceProxy).toBe(false)
    expect('baz' in instanceProxy).toBe(false)

    // set non-existent (goes into sink)
    instanceProxy.baz = 1
    expect('baz' in instanceProxy).toBe(true)
  })
})
