import { createApp, h } from 'vue'
import { renderToString, renderComponent, renderSlot } from '../src'

describe('ssr: renderToString', () => {
  describe('components', () => {
    test('vnode components', async () => {
      expect(
        await renderToString(
          createApp({
            data() {
              return { msg: 'hello' }
            },
            render(this: any) {
              return h('div', this.msg)
            }
          })
        )
      ).toBe(`<div>hello</div>`)
    })

    test('optimized components', async () => {
      expect(
        await renderToString(
          createApp({
            data() {
              return { msg: 'hello' }
            },
            ssrRender(ctx, push) {
              push(`<div>${ctx.msg}</div>`)
            }
          })
        )
      ).toBe(`<div>hello</div>`)
    })

    test('nested vnode components', async () => {
      const Child = {
        props: ['msg'],
        render(this: any) {
          return h('div', this.msg)
        }
      }

      expect(
        await renderToString(
          createApp({
            render() {
              return h('div', ['parent', h(Child, { msg: 'hello' })])
            }
          })
        )
      ).toBe(`<div>parent<div>hello</div></div>`)
    })

    test('nested optimized components', async () => {
      const Child = {
        props: ['msg'],
        ssrRender(ctx: any, push: any) {
          push(`<div>${ctx.msg}</div>`)
        }
      }

      expect(
        await renderToString(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(renderComponent(Child, { msg: 'hello' }, null, parent))
              push(`</div>`)
            }
          })
        )
      ).toBe(`<div>parent<div>hello</div></div>`)
    })

    test('mixing optimized / vnode components', async () => {
      const OptimizedChild = {
        props: ['msg'],
        ssrRender(ctx: any, push: any) {
          push(`<div>${ctx.msg}</div>`)
        }
      }

      const VNodeChild = {
        props: ['msg'],
        render(this: any) {
          return h('div', this.msg)
        }
      }

      expect(
        await renderToString(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(
                renderComponent(OptimizedChild, { msg: 'opt' }, null, parent)
              )
              push(renderComponent(VNodeChild, { msg: 'vnode' }, null, parent))
              push(`</div>`)
            }
          })
        )
      ).toBe(`<div>parent<div>opt</div><div>vnode</div></div>`)
    })

    test('nested components with optimized slots', async () => {
      const Child = {
        props: ['msg'],
        ssrRender(ctx: any, push: any, parent: any) {
          push(`<div class="child">`)
          renderSlot(ctx.$slots.default, { msg: 'from slot' }, push, parent)
          push(`</div>`)
        }
      }

      expect(
        await renderToString(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(
                renderComponent(
                  Child,
                  { msg: 'hello' },
                  {
                    // optimized slot using string push
                    default: ({ msg }: any, push: any) => {
                      push(`<span>${msg}</span>`)
                    },
                    _compiled: true // important to avoid slots being normalized
                  },
                  parent
                )
              )
              push(`</div>`)
            }
          })
        )
      ).toBe(
        `<div>parent<div class="child">` +
          `<!----><span>from slot</span><!---->` +
          `</div></div>`
      )
    })

    test('nested components with vnode slots', async () => {
      const Child = {
        props: ['msg'],
        ssrRender(ctx: any, push: any, parent: any) {
          push(`<div class="child">`)
          renderSlot(ctx.$slots.default, { msg: 'from slot' }, push, parent)
          push(`</div>`)
        }
      }

      expect(
        await renderToString(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(
                renderComponent(
                  Child,
                  { msg: 'hello' },
                  {
                    // bailed slots returning raw vnodes
                    default: ({ msg }: any) => {
                      return h('span', msg)
                    }
                  },
                  parent
                )
              )
              push(`</div>`)
            }
          })
        )
      ).toBe(
        `<div>parent<div class="child">` +
          `<!----><span>from slot</span><!---->` +
          `</div></div>`
      )
    })

    test('async components', async () => {
      const Child = {
        // should wait for resovled render context from setup()
        async setup() {
          return {
            msg: 'hello'
          }
        },
        ssrRender(ctx: any, push: any) {
          push(`<div>${ctx.msg}</div>`)
        }
      }

      expect(
        await renderToString(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(renderComponent(Child, null, null, parent))
              push(`</div>`)
            }
          })
        )
      ).toBe(`<div>parent<div>hello</div></div>`)
    })

    test('parallel async components', async () => {
      const OptimizedChild = {
        props: ['msg'],
        async setup(props: any) {
          return {
            localMsg: props.msg + '!'
          }
        },
        ssrRender(ctx: any, push: any) {
          push(`<div>${ctx.localMsg}</div>`)
        }
      }

      const VNodeChild = {
        props: ['msg'],
        async setup(props: any) {
          return {
            localMsg: props.msg + '!'
          }
        },
        render(this: any) {
          return h('div', this.localMsg)
        }
      }

      expect(
        await renderToString(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(
                renderComponent(OptimizedChild, { msg: 'opt' }, null, parent)
              )
              push(renderComponent(VNodeChild, { msg: 'vnode' }, null, parent))
              push(`</div>`)
            }
          })
        )
      ).toBe(`<div>parent<div>opt!</div><div>vnode!</div></div>`)
    })
  })

  describe('scopeId', () => {
    // TODO
  })

  describe('vnode', () => {
    test('text children', () => {})

    test('array children', () => {})

    test('void elements', () => {})

    test('innerHTML', () => {})

    test('textContent', () => {})

    test('textarea value', () => {})
  })
})
