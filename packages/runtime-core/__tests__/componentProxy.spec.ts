import { createApp, getCurrentInstance, nodeOps } from '@vue/runtime-test'
import { PublicInstanceProxyHandlers } from '../src/componentProxy'

describe('component: proxy', () => {
  it('data', () => {
    const app = createApp()
    let ctx: any
    const Comp = {
      data() {
        return {
          foo: 1
        }
      },
      mounted() {
        ctx = getCurrentInstance()
      },
      render(this: any) {
        return `${this.foo}`
      }
    }
    app.mount(Comp, nodeOps.createElement('div'))
    const instanceProxy = new Proxy(ctx, PublicInstanceProxyHandlers)
    expect(instanceProxy.foo).toBe(1)
    instanceProxy.foo = 2
    expect(ctx.data.foo).toBe(2)
  })

  it('renderContext', () => {
    const app = createApp()
    let ctx: any
    const Comp = {
      setup() {
        ctx = getCurrentInstance()
        return {
          foo: 1
        }
      }
    }
    app.mount(Comp, nodeOps.createElement('div'))
    const instanceProxy = new Proxy(ctx, PublicInstanceProxyHandlers)
    expect(instanceProxy.foo).toBe(1)
    instanceProxy.foo = 2
    expect(ctx.renderContext.foo).toBe(2)
  })

  it('propsProxy', () => {
    const app = createApp()
    let ctx: any
    const Comp = {
      props: {
        foo: {
          type: Number,
          default: 1
        }
      },
      setup() {
        ctx = getCurrentInstance()
      }
    }
    app.mount(Comp, nodeOps.createElement('div'))
    const instanceProxy = new Proxy(ctx, PublicInstanceProxyHandlers)
    expect(instanceProxy.foo).toBe(1)
    expect(() => (instanceProxy.foo = 2)).toThrow(TypeError)
  })

  it('methods', () => {
    const app = createApp()
    let ctx: any
    const Comp = {
      setup() {
        ctx = getCurrentInstance()
      }
    }
    app.mount(Comp, nodeOps.createElement('div'))
    const instanceProxy = new Proxy(ctx, PublicInstanceProxyHandlers)
    expect(instanceProxy.$data).toBe(ctx.data)
    expect(instanceProxy.$props).toBe(ctx.propsProxy)
    expect(instanceProxy.$attrs).toBe(ctx.attrs)
    expect(instanceProxy.$slots).toBe(ctx.slots)
    expect(instanceProxy.$refs).toBe(ctx.refs)
    expect(instanceProxy.$parent).toBe(ctx.parent)
    expect(instanceProxy.$root).toBe(ctx.root)
    expect(instanceProxy.$emit).toBe(ctx.emit)
    expect(instanceProxy.$el).toBe(ctx.vnode.el)
    expect(instanceProxy.$options).toBe(ctx.type)
    expect(() => (instanceProxy.$data = {})).toThrow(TypeError)
  })

  it('user', async () => {
    const app = createApp()
    let ctx: any
    const Comp = {
      setup() {
        ctx = getCurrentInstance()
      }
    }
    app.mount(Comp, nodeOps.createElement('div'))
    const instanceProxy = new Proxy(ctx, PublicInstanceProxyHandlers)
    instanceProxy.foo = 1
    expect(instanceProxy.foo).toBe(1)
    expect(ctx.user.foo).toBe(1)
  })
})
