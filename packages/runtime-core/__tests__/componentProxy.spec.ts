import { h, render, getCurrentInstance, nodeOps } from '@vue/runtime-test'
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

  test('propsProxy', () => {
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
    render(h(Comp), nodeOps.createElement('div'))
    expect(instanceProxy.foo).toBe(1)
    expect(instance!.propsProxy!.foo).toBe(1)
    expect(() => (instanceProxy.foo = 2)).toThrow(TypeError)
    expect(`Attempting to mutate prop "foo"`).toHaveBeenWarned()
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
    render(h(Comp, { msg: 'hello' }), nodeOps.createElement('div'))

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
