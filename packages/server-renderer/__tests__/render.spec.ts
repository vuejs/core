import {
  createApp,
  h,
  createCommentVNode,
  resolveComponent,
  ComponentOptions,
  ref,
  defineComponent,
  createTextVNode,
  createStaticVNode,
  withCtx,
  KeepAlive,
  Transition,
  watchEffect
} from 'vue'
import { escapeHtml } from '@vue/shared'
import { renderToString } from '../src/renderToString'
import { renderToStream as _renderToStream } from '../src/renderToStream'
import { ssrRenderSlot, SSRSlot } from '../src/helpers/ssrRenderSlot'
import { ssrRenderComponent } from '../src/helpers/ssrRenderComponent'
import { Readable } from 'stream'

const promisifyStream = (stream: Readable) => {
  return new Promise<string>((resolve, reject) => {
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

// we run the same tests twice, once for renderToString, once for renderToStream
testRender(`renderToString`, renderToString)
testRender(`renderToStream`, renderToStream)

function testRender(type: string, render: typeof renderToString) {
  describe(`ssr: ${type}`, () => {
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
      const html = await render(app)
      expect(html).toBe(`<div>foo</div>`)
    })

    describe('components', () => {
      test('vnode components', async () => {
        expect(
          await render(
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
          await render(
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
          await render(
            createApp(
              defineComponent(() => {
                const msg = ref('hello')
                return () => h('div', msg.value)
              })
            )
          )
        ).toBe(`<div>hello</div>`)
      })

      test('components using defineComponent with extends option', async () => {
        expect(
          await render(
            createApp(
              defineComponent({
                extends: {
                  data() {
                    return { msg: 'hello' }
                  },
                  render(this: any) {
                    return h('div', this.msg)
                  }
                }
              })
            )
          )
        ).toBe(`<div>hello</div>`)
      })

      test('components using defineComponent with mixins option', async () => {
        expect(
          await render(
            createApp(
              defineComponent({
                mixins: [
                  {
                    data() {
                      return { msg: 'hello' }
                    },
                    render(this: any) {
                      return h('div', this.msg)
                    }
                  }
                ]
              })
            )
          )
        ).toBe(`<div>hello</div>`)
      })

      test('optimized components', async () => {
        expect(
          await render(
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
          await render(
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
          await render(
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

        expect(await render(app)).toBe(`<div>parent<div>hello</div></div>`)
      })

      test('template components with dynamic class attribute after static', async () => {
        const app = createApp({
          template: `<div><div class="child" :class="'dynamic'"></div></div>`
        })
        expect(await render(app)).toBe(
          `<div><div class="dynamic child"></div></div>`
        )
      })

      test('template components with dynamic class attribute before static', async () => {
        const app = createApp({
          template: `<div><div :class="'dynamic'" class="child"></div></div>`
        })
        expect(await render(app)).toBe(
          `<div><div class="dynamic child"></div></div>`
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
          await render(
            createApp({
              ssrRender(_ctx, push, parent) {
                push(`<div>parent`)
                push(
                  ssrRenderComponent(
                    OptimizedChild,
                    { msg: 'opt' },
                    null,
                    parent
                  )
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
          await render(
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
          await render(
            createApp({
              ssrRender(_ctx, push, parent) {
                push(`<div>parent`)
                push(
                  ssrRenderComponent(
                    OptimizedChild,
                    { msg: 'opt' },
                    null,
                    parent
                  )
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

    describe('slots', () => {
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
          await render(
            createApp({
              ssrRender(_ctx, push, parent) {
                push(`<div>parent`)
                push(
                  ssrRenderComponent(
                    Child,
                    { msg: 'hello' },
                    {
                      // optimized slot using string push
                      default: (({ msg }, push, _p) => {
                        push(`<span>${msg}</span>`)
                      }) as SSRSlot,
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
          await render(
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
          await render(
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

        expect(await render(app)).toBe(
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

        expect(await render(app)).toBe(
          `<div>parent<div class="child">` +
            // no comment anchors because slot is used directly as element children
            `<span>from slot</span>` +
            `</div></div>`
        )
      })

      test('template slots forwarding', async () => {
        const Child = {
          template: `<div><slot/></div>`
        }

        const Parent = {
          components: { Child },
          template: `<Child><slot/></Child>`
        }

        const app = createApp({
          components: { Parent },
          template: `<Parent>hello</Parent>`
        })

        expect(await render(app)).toBe(
          `<div><!--[--><!--[-->hello<!--]--><!--]--></div>`
        )
      })

      test('template slots forwarding, empty slot', async () => {
        const Child = {
          template: `<div><slot/></div>`
        }

        const Parent = {
          components: { Child },
          template: `<Child><slot/></Child>`
        }

        const app = createApp({
          components: { Parent },
          template: `<Parent></Parent>`
        })

        expect(await render(app)).toBe(
          // should only have a single fragment
          `<div><!--[--><!--]--></div>`
        )
      })

      test('template slots forwarding, empty slot w/ fallback', async () => {
        const Child = {
          template: `<div><slot>fallback</slot></div>`
        }

        const Parent = {
          components: { Child },
          template: `<Child><slot/></Child>`
        }

        const app = createApp({
          components: { Parent },
          template: `<Parent></Parent>`
        })

        expect(await render(app)).toBe(
          // should only have a single fragment
          `<div><!--[-->fallback<!--]--></div>`
        )
      })
    })

    describe('vnode element', () => {
      test('props', async () => {
        expect(
          await render(h('div', { id: 'foo&', class: ['bar', 'baz'] }, 'hello'))
        ).toBe(`<div id="foo&amp;" class="bar baz">hello</div>`)
      })

      test('text children', async () => {
        expect(await render(h('div', 'hello'))).toBe(`<div>hello</div>`)
      })

      test('array children', async () => {
        expect(
          await render(
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
        expect(await render(h('input'))).toBe(`<input>`)
      })

      test('innerHTML', async () => {
        expect(
          await render(
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
          await render(
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
          await render(
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

    describe('vnode component', () => {
      test('KeepAlive', async () => {
        const MyComp = {
          render: () => h('p', 'hello')
        }
        expect(await render(h(KeepAlive, () => h(MyComp)))).toBe(
          `<!--[--><p>hello</p><!--]-->`
        )
      })

      test('Transition', async () => {
        const MyComp = {
          render: () => h('p', 'hello')
        }
        expect(await render(h(Transition, () => h(MyComp)))).toBe(
          `<p>hello</p>`
        )
      })
    })

    describe('raw vnode types', () => {
      test('Text', async () => {
        expect(await render(createTextVNode('hello <div>'))).toBe(
          `hello &lt;div&gt;`
        )
      })

      test('Comment', async () => {
        // https://www.w3.org/TR/html52/syntax.html#comments
        expect(
          await render(
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
        expect(await render(createStaticVNode(content, 1))).toBe(content)
      })
    })

    describe('scopeId', () => {
      // note: here we are only testing scopeId handling for vdom serialization.
      // compiled srr render functions will include scopeId directly in strings.

      test('basic', async () => {
        const Foo = {
          __scopeId: 'data-v-test',
          render() {
            return h('div')
          }
        }
        expect(await render(h(Foo))).toBe(`<div data-v-test></div>`)
      })

      test('with slots', async () => {
        const Child = {
          __scopeId: 'data-v-child',
          render: function(this: any) {
            return h('div', this.$slots.default())
          }
        }

        const Parent = {
          __scopeId: 'data-v-test',
          render: () => {
            return h(Child, null, {
              default: withCtx(() => h('span', 'slot'))
            })
          }
        }

        expect(await render(h(Parent))).toBe(
          `<div data-v-child data-v-test><span data-v-test data-v-child-s>slot</span></div>`
        )
      })
    })

    describe('integration w/ compiled template', () => {
      test('render', async () => {
        expect(
          await render(
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
        await render(
          // render different content since compilation is cached
          createApp({ template: `<${type === 'renderToString' ? 'div' : 'p'}` })
        )

        expect(
          `Template compilation error: Unexpected EOF in tag.`
        ).toHaveBeenWarned()
        expect(`Element is missing end tag`).toHaveBeenWarned()
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
      const html = await render(app)
      expect(html).toBe(`<div>hello</div>`)
    })

    // #2763
    test('error handling w/ async setup', async () => {
      const fn = jest.fn()
      const fn2 = jest.fn()

      const asyncChildren = defineComponent({
        async setup() {
          return Promise.reject('async child error')
        },
        template: `<div>asyncChildren</div>`
      })
      const app = createApp({
        name: 'App',
        components: {
          asyncChildren
        },
        template: `<div class="app"><async-children /></div>`,
        errorCaptured(error) {
          fn(error)
        }
      })

      app.config.errorHandler = error => {
        fn2(error)
      }

      const html = await renderToString(app)
      expect(html).toBe(`<div class="app"><div>asyncChildren</div></div>`)

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toBeCalledWith('async child error')

      expect(fn2).toHaveBeenCalledTimes(1)
      expect(fn2).toBeCalledWith('async child error')

      expect('Uncaught error in async setup').toHaveBeenWarned()
    })
    
    // https://github.com/vuejs/vue-next/issues/3322
    test('effect onInvalidate does not error', async () => {
      const noop = () => {}
      const app = createApp({
        setup: () => {
          watchEffect(onInvalidate => onInvalidate(noop))
        },
        render: noop
      })
      expect(await render(app)).toBe('<!---->')
    })
  })
}
