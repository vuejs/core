import {
  createApp,
  getCurrentInstance,
  nodeOps,
  mockWarn,
  nextTick
} from '@vue/runtime-test'
import { ComponentInternalInstance } from '../src/component'

describe('component: proxy', () => {
  mockWarn()

  it('data', () => {
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

  it('renderContext', () => {
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

  it('propsProxy', () => {
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

  it('methods', () => {
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

  it('user', async () => {
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
    expect(instance!.user.foo).toBe(1)
  })

  it('watch', async () => {
    const foobar = jest.fn()

    const app = createApp()
    let instanceProxy: any
    const Comp = {
      data() {
        return {
          foo: {
            bar: 1,
            baz: 2
          }
        }
      },
      mounted() {
        instanceProxy = this
      },
      render() {
        return null
      }
    }
    app.mount(Comp, nodeOps.createElement('div'))
    instanceProxy.$watch('foo.bar', foobar)

    instanceProxy.foo.bar++
    await nextTick()
    expect(foobar).toHaveBeenCalledTimes(1)
    expect(foobar.mock.calls[0][0]).toBe(2)

    instanceProxy.foo.baz++
    await nextTick()
    expect(foobar).toHaveBeenCalledTimes(1)
  })
})
