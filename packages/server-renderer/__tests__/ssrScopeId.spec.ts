import { createApp, withScopeId } from 'vue'
import { renderToString } from '../src/renderToString'
import { ssrRenderComponent, ssrRenderAttrs, ssrRenderSlot } from '../src'

describe('ssr: scoped id on component root', () => {
  test('basic', async () => {
    const withParentId = withScopeId('parent')

    const Child = {
      ssrRender: (ctx: any, push: any, parent: any, attrs: any) => {
        push(`<div${ssrRenderAttrs(attrs)}></div>`)
      }
    }

    const Comp = {
      ssrRender: withParentId((ctx: any, push: any, parent: any) => {
        push(ssrRenderComponent(Child), null, null, parent)
      })
    }

    const result = await renderToString(createApp(Comp))
    expect(result).toBe(`<div parent></div>`)
  })

  test('inside slot', async () => {
    const withParentId = withScopeId('parent')

    const Child = {
      ssrRender: (_: any, push: any, _parent: any, attrs: any) => {
        push(`<div${ssrRenderAttrs(attrs)} child></div>`)
      }
    }

    const Wrapper = {
      __scopeId: 'wrapper',
      ssrRender: (ctx: any, push: any, parent: any) => {
        ssrRenderSlot(ctx.$slots, 'default', {}, null, push, parent)
      }
    }

    const Comp = {
      ssrRender: withParentId((_: any, push: any, parent: any) => {
        push(
          ssrRenderComponent(
            Wrapper,
            null,
            {
              default: withParentId((_: any, push: any, parent: any) => {
                push(ssrRenderComponent(Child, null, null, parent))
              }),
              _: 1
            } as any,
            parent
          )
        )
      })
    }

    const result = await renderToString(createApp(Comp))
    expect(result).toBe(`<!--[--><div parent wrapper-s child></div><!--]-->`)
  })
})
