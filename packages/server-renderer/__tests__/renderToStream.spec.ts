import {
  createApp,
  h,
  createCommentVNode,
  withScopeId,
  resolveComponent,
  ComponentOptions,
  ref,
  defineComponent,
  createTextVNode,
  createStaticVNode
} from 'vue'
import { escapeHtml } from '@vue/shared'
import { renderToStream as _renderToStream } from '../src/renderToStream'
import { Readable } from 'stream'
import { ssrRenderSlot } from '../src/helpers/ssrRenderSlot'
import { ssrRenderComponent } from '../src/helpers/ssrRenderComponent'

const promisifyStream = (stream: Readable) => {
  return new Promise((resolve, reject) => {
    let result = ''
    stream.on('data', data => {
      result += data
    })
    stream.on('error', () => {
      reject(result)
    })
    stream.on('end', () => {
      resolve(result)
    })
  })
}

const renderToStream = (app: any, context?: any) =>
  promisifyStream(_renderToStream(app, context))

describe('ssr: renderToStream', () => {
  test('should apply app context', async () => {
    const app = createApp({
      render() {
        const Foo = resolveComponent('foo') as ComponentOptions
        return h(Foo)
      }
    })
    app.component('foo', {
      render: () => h('div', 'foo')
    })
    const html = await renderToStream(app)
    expect(html).toBe(`<div>foo</div>`)
  })

  describe('components', () => {
    test('vnode components', async () => {
      expect(
        await renderToStream(
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

    test('option components returning render from setup', async () => {
      expect(
        await renderToStream(
          createApp({
            setup() {
              const msg = ref('hello')
              return () => h('div', msg.value)
            }
          })
        )
      ).toBe(`<div>hello</div>`)
    })

    test('setup components returning render from setup', async () => {
      expect(
        await renderToStream(
          createApp(
            defineComponent(() => {
              const msg = ref('hello')
              return () => h('div', msg.value)
            })
          )
        )
      ).toBe(`<div>hello</div>`)
    })

    test('optimized components', async () => {
      expect(
        await renderToStream(
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

    describe('template components', () => {
      test('render', async () => {
        expect(
          await renderToStream(
            createApp({
              data() {
                return { msg: 'hello' }
              },
              template: `<div>{{ msg }}</div>`
            })
          )
        ).toBe(`<div>hello</div>`)
      })

      test('handle compiler errors', async () => {
        await renderToStream(createApp({ template: `<` }))

        expect(
          'Template compilation error: Unexpected EOF in tag.\n' +
            '1  |  <\n' +
            '   |   ^'
        ).toHaveBeenWarned()
      })
    })

    test('nested vnode components', async () => {
      const Child = {
        props: ['msg'],
        render(this: any) {
          return h('div', this.msg)
        }
      }

      expect(
        await renderToStream(
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
        await renderToStream(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(ssrRenderComponent(Child, { msg: 'hello' }, null, parent))
              push(`</div>`)
            }
          })
        )
      ).toBe(`<div>parent<div>hello</div></div>`)
    })

    test('nested template components', async () => {
      const Child = {
        props: ['msg'],
        template: `<div>{{ msg }}</div>`
      }
      const app = createApp({
        template: `<div>parent<Child msg="hello" /></div>`
      })
      app.component('Child', Child)

      expect(await renderToStream(app)).toBe(
        `<div>parent<div>hello</div></div>`
      )
    })

    test('mixing optimized / vnode / template components', async () => {
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

      const TemplateChild = {
        props: ['msg'],
        template: `<div>{{ msg }}</div>`
      }

      expect(
        await renderToStream(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(
                ssrRenderComponent(OptimizedChild, { msg: 'opt' }, null, parent)
              )
              push(
                ssrRenderComponent(VNodeChild, { msg: 'vnode' }, null, parent)
              )
              push(
                ssrRenderComponent(
                  TemplateChild,
                  { msg: 'template' },
                  null,
                  parent
                )
              )
              push(`</div>`)
            }
          })
        )
      ).toBe(
        `<div>parent<div>opt</div><div>vnode</div><div>template</div></div>`
      )
    })

    test('nested components with optimized slots', async () => {
      const Child = {
        props: ['msg'],
        ssrRender(ctx: any, push: any, parent: any) {
          push(`<div class="child">`)
          ssrRenderSlot(
            ctx.$slots,
            'default',
            { msg: 'from slot' },
            () => {
              push(`fallback`)
            },
            push,
            parent
          )
          push(`</div>`)
        }
      }

      expect(
        await renderToStream(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(
                ssrRenderComponent(
                  Child,
                  { msg: 'hello' },
                  {
                    // optimized slot using string push
                    default: ({ msg }: any, push: any) => {
                      push(`<span>${msg}</span>`)
                    },
                    // important to avoid slots being normalized
                    _: 1 as any
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
          `<!--[--><span>from slot</span><!--]-->` +
          `</div></div>`
      )

      // test fallback
      expect(
        await renderToStream(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(ssrRenderComponent(Child, { msg: 'hello' }, null, parent))
              push(`</div>`)
            }
          })
        )
      ).toBe(
        `<div>parent<div class="child"><!--[-->fallback<!--]--></div></div>`
      )
    })

    test('nested components with vnode slots', async () => {
      const Child = {
        props: ['msg'],
        ssrRender(ctx: any, push: any, parent: any) {
          push(`<div class="child">`)
          ssrRenderSlot(
            ctx.$slots,
            'default',
            { msg: 'from slot' },
            null,
            push,
            parent
          )
          push(`</div>`)
        }
      }

      expect(
        await renderToStream(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(
                ssrRenderComponent(
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
          `<!--[--><span>from slot</span><!--]-->` +
          `</div></div>`
      )
    })

    test('nested components with template slots', async () => {
      const Child = {
        props: ['msg'],
        template: `<div class="child"><slot msg="from slot"></slot></div>`
      }

      const app = createApp({
        components: { Child },
        template: `<div>parent<Child v-slot="{ msg }"><span>{{ msg }}</span></Child></div>`
      })

      expect(await renderToStream(app)).toBe(
        `<div>parent<div class="child">` +
          `<!--[--><span>from slot</span><!--]-->` +
          `</div></div>`
      )
    })

    test('nested render fn components with template slots', async () => {
      const Child = {
        props: ['msg'],
        render(this: any) {
          return h(
            'div',
            {
              class: 'child'
            },
            this.$slots.default({ msg: 'from slot' })
          )
        }
      }

      const app = createApp({
        template: `<div>parent<Child v-slot="{ msg }"><span>{{ msg }}</span></Child></div>`
      })
      app.component('Child', Child)

      expect(await renderToStream(app)).toBe(
        `<div>parent<div class="child">` +
          // no comment anchors because slot is used directly as element children
          `<span>from slot</span>` +
          `</div></div>`
      )
    })

    test('async components', async () => {
      const Child = {
        // should wait for resolved render context from setup()
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
        await renderToStream(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(ssrRenderComponent(Child, null, null, parent))
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
        await renderToStream(
          createApp({
            ssrRender(_ctx, push, parent) {
              push(`<div>parent`)
              push(
                ssrRenderComponent(OptimizedChild, { msg: 'opt' }, null, parent)
              )
              push(
                ssrRenderComponent(VNodeChild, { msg: 'vnode' }, null, parent)
              )
              push(`</div>`)
            }
          })
        )
      ).toBe(`<div>parent<div>opt!</div><div>vnode!</div></div>`)
    })
  })

  describe('vnode element', () => {
    test('props', async () => {
      expect(
        await renderToStream(
          h('div', { id: 'foo&', class: ['bar', 'baz'] }, 'hello')
        )
      ).toBe(`<div id="foo&amp;" class="bar baz">hello</div>`)
    })

    test('text children', async () => {
      expect(await renderToStream(h('div', 'hello'))).toBe(`<div>hello</div>`)
    })

    test('array children', async () => {
      expect(
        await renderToStream(
          h('div', [
            'foo',
            h('span', 'bar'),
            [h('span', 'baz')],
            createCommentVNode('qux')
          ])
        )
      ).toBe(
        `<div>foo<span>bar</span><!--[--><span>baz</span><!--]--><!--qux--></div>`
      )
    })

    test('void elements', async () => {
      expect(await renderToStream(h('input'))).toBe(`<input>`)
    })

    test('innerHTML', async () => {
      expect(
        await renderToStream(
          h(
            'div',
            {
              innerHTML: `<span>hello</span>`
            },
            'ignored'
          )
        )
      ).toBe(`<div><span>hello</span></div>`)
    })

    test('textContent', async () => {
      expect(
        await renderToStream(
          h(
            'div',
            {
              textContent: `<span>hello</span>`
            },
            'ignored'
          )
        )
      ).toBe(`<div>${escapeHtml(`<span>hello</span>`)}</div>`)
    })

    test('textarea value', async () => {
      expect(
        await renderToStream(
          h(
            'textarea',
            {
              value: `<span>hello</span>`
            },
            'ignored'
          )
        )
      ).toBe(`<textarea>${escapeHtml(`<span>hello</span>`)}</textarea>`)
    })
  })

  describe('raw vnode types', () => {
    test('Text', async () => {
      expect(await renderToStream(createTextVNode('hello <div>'))).toBe(
        `hello &lt;div&gt;`
      )
    })

    test('Comment', async () => {
      // https://www.w3.org/TR/html52/syntax.html#comments
      expect(
        await renderToStream(
          h('div', [
            createCommentVNode('>foo'),
            createCommentVNode('->foo'),
            createCommentVNode('<!--foo-->'),
            createCommentVNode('--!>foo<!-')
          ])
        )
      ).toBe(`<div><!--foo--><!--foo--><!--foo--><!--foo--></div>`)
    })

    test('Static', async () => {
      const content = `<div id="ok">hello<span>world</span></div>`
      expect(await renderToStream(createStaticVNode(content, 1))).toBe(content)
    })
  })

  describe('scopeId', () => {
    // note: here we are only testing scopeId handling for vdom serialization.
    // compiled srr render functions will include scopeId directly in strings.
    const withId = withScopeId('data-v-test')
    const withChildId = withScopeId('data-v-child')

    test('basic', async () => {
      expect(
        await renderToStream(
          withId(() => {
            return h('div')
          })()
        )
      ).toBe(`<div data-v-test></div>`)
    })

    test('with slots', async () => {
      const Child = {
        __scopeId: 'data-v-child',
        render: withChildId(function(this: any) {
          return h('div', this.$slots.default())
        })
      }

      const Parent = {
        __scopeId: 'data-v-test',
        render: withId(() => {
          return h(Child, null, {
            default: withId(() => h('span', 'slot'))
          })
        })
      }

      expect(await renderToStream(h(Parent))).toBe(
        `<div data-v-child data-v-test><span data-v-test data-v-child-s>slot</span></div>`
      )
    })
  })

  test('serverPrefetch', async () => {
    const msg = Promise.resolve('hello')
    const app = createApp({
      data() {
        return {
          msg: ''
        }
      },
      async serverPrefetch() {
        this.msg = await msg
      },
      render() {
        return h('div', this.msg)
      }
    })
    const html = await renderToStream(app)
    expect(html).toBe(`<div>hello</div>`)
  })
})
