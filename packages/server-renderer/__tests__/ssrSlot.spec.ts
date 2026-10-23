import {
  cloneVNode,
  createApp,
  createCommentVNode,
  defineAsyncComponent,
  h,
  renderSlot,
  withCtx,
} from 'vue'
import { renderToString } from '../src/renderToString'

const components = {
  one: {
    template: `<div><slot/></div>`,
  },
}

describe('ssr: slot', () => {
  test('text slot', async () => {
    expect(
      await renderToString(
        createApp({
          components,
          template: `<one>hello</one>`,
        }),
      ),
    ).toBe(`<div><!--[-->hello<!--]--></div>`)
  })

  test('element slot', async () => {
    expect(
      await renderToString(
        createApp({
          components,
          template: `<one><div>hi</div></one>`,
        }),
      ),
    ).toBe(`<div><!--[--><div>hi</div><!--]--></div>`)
  })

  test('empty slot', async () => {
    expect(
      await renderToString(
        createApp({
          components: {
            one: {
              template: `<div><slot/></div>`,
            },
          },
          template: `<one><template v-if="false"/></one>`,
        }),
      ),
    ).toBe(`<div><!--[--><!--]--></div>`)
  })

  test('empty slot (manual comments)', async () => {
    expect(
      await renderToString(
        createApp({
          components: {
            one: {
              template: `<div><slot/></div>`,
            },
          },
          template: `<one><!--hello--></one>`,
        }),
      ),
    ).toBe(`<div><!--[--><!--]--></div>`)
  })

  test('empty slot (multi-line comments)', async () => {
    expect(
      await renderToString(
        createApp({
          components: {
            one: {
              template: `<div><slot/></div>`,
            },
          },
          template: `<one><!--he\nllo--></one>`,
        }),
      ),
    ).toBe(`<div><!--[--><!--]--></div>`)
  })

  test('multiple elements', async () => {
    expect(
      await renderToString(
        createApp({
          components,
          template: `<one><div>one</div><div>two</div></one>`,
        }),
      ),
    ).toBe(`<div><!--[--><div>one</div><div>two</div><!--]--></div>`)
  })

  test('fragment slot (template v-if)', async () => {
    expect(
      await renderToString(
        createApp({
          components,
          template: `<one><template v-if="true">hello</template></one>`,
        }),
      ),
    ).toBe(`<div><!--[--><!--[-->hello<!--]--><!--]--></div>`)
  })

  test('fragment slot (template v-if + multiple elements)', async () => {
    expect(
      await renderToString(
        createApp({
          components,
          template: `<one><template v-if="true"><div>one</div><div>two</div></template></one>`,
        }),
      ),
    ).toBe(
      `<div><!--[--><!--[--><div>one</div><div>two</div><!--]--><!--]--></div>`,
    )
  })

  test('nullish slot props', async () => {
    const nullishBind = {
      one: {
        props: ['value'],
        template: `<div><slot v-bind="value" name="foo">fallback</slot></div>`,
      },
    }

    expect(
      await renderToString(
        createApp({
          components: nullishBind,
          template: `<one :value="null"/>`,
        }),
      ),
    ).toBe(`<div><!--(-->fallback<!--)--></div>`)

    expect(
      await renderToString(
        createApp({
          components: nullishBind,
          template: `<one :value="null"><template #foo="{ label }">{{ label || 'none' }}</template></one>`,
        }),
      ),
    ).toBe(`<div><!--[-->none<!--]--></div>`)
  })

  test('transition slot', async () => {
    const ReusableTransition = {
      template: `<transition><slot/></transition>`,
    }

    const ReusableTransitionWithAppear = {
      template: `<transition appear><slot/></transition>`,
    }

    expect(
      await renderToString(
        createApp({
          components: {
            one: ReusableTransition,
          },
          template: `<one><div v-if="false">foo</div></one>`,
        }),
      ),
    ).toBe(`<!---->`)

    expect(await renderToString(createApp(ReusableTransition))).toBe(`<!---->`)

    expect(await renderToString(createApp(ReusableTransitionWithAppear))).toBe(
      `<template><!----></template>`,
    )

    expect(
      await renderToString(
        createApp({
          components: {
            one: ReusableTransition,
          },
          template: `<one><slot/></one>`,
        }),
      ),
    ).toBe(`<!---->`)

    expect(
      await renderToString(
        createApp({
          components: {
            one: ReusableTransitionWithAppear,
          },
          template: `<one><slot/></one>`,
        }),
      ),
    ).toBe(`<template><!----></template>`)

    expect(
      await renderToString(
        createApp({
          render() {
            return h(ReusableTransition, null, {
              default: () => null,
            })
          },
        }),
      ),
    ).toBe(`<!---->`)

    expect(
      await renderToString(
        createApp({
          render() {
            return h(ReusableTransitionWithAppear, null, {
              default: () => null,
            })
          },
        }),
      ),
    ).toBe(`<template><!----></template>`)

    expect(
      await renderToString(
        createApp({
          render() {
            return h(ReusableTransitionWithAppear, null, {
              default: () => [],
            })
          },
        }),
      ),
    ).toBe(`<template><!----></template>`)

    expect(
      await renderToString(
        createApp({
          render() {
            return h(ReusableTransition, null, {
              default: () => [],
            })
          },
        }),
      ),
    ).toBe(`<!---->`)

    expect(
      await renderToString(
        createApp({
          components: {
            one: ReusableTransition,
          },
          template: `<one><div v-if="true">foo</div></one>`,
        }),
      ),
    ).toBe(`<div>foo</div>`)
  })

  // #9933
  test('transition-group slot', async () => {
    expect(
      await renderToString(
        createApp({
          components: {
            one: {
              template: `<TransitionGroup tag="div"><slot/></TransitionGroup>`,
            },
          },
          template: `<one><p v-for="i in 2">{{i}}</p></one>`,
        }),
      ),
    ).toBe(`<div><p>1</p><p>2</p></div>`)
  })

  // #12438
  test('async component slot with v-if true', async () => {
    const Layout = defineAsyncComponent(() =>
      Promise.resolve({
        template: `<div><slot name="header">default header</slot></div>`,
      }),
    )
    const LayoutLoader = {
      setup(_: any, context: any) {
        return () => h(Layout, {}, context.slots)
      },
    }
    expect(
      await renderToString(
        createApp({
          components: {
            LayoutLoader,
          },
          template: `
            <Suspense>
              <LayoutLoader>
                <template v-if="true" #header>
                  new header
                </template>
              </LayoutLoader>
            </Suspense>
          `,
        }),
      ),
    ).toBe(`<div><!--[--> new header <!--]--></div>`)
  })

  // #11326
  test('dynamic component slot', async () => {
    expect(
      await renderToString(
        createApp({
          components: {
            ButtonComp: {
              template: `<component is="button"><slot/></component>`,
            },
            Wrap: {
              template: `<div><slot/></div>`,
            },
          },
          template: `<ButtonComp><Wrap><div v-if="false">hello</div></Wrap></ButtonComp>`,
        }),
      ),
    ).toBe(`<button><!--[--><div><!--[--><!--]--></div><!--]--></button>`)

    expect(
      await renderToString(
        createApp({
          components: {
            ButtonComp: {
              template: `<component is="button"><slot/></component>`,
            },
            Wrap: {
              template: `<div><slot/></div>`,
            },
          },
          template: `<ButtonComp><Wrap><div v-if="true">hello</div></Wrap></ButtonComp>`,
        }),
      ),
    ).toBe(
      `<button><!--[--><div><!--[--><div>hello</div><!--]--></div><!--]--></button>`,
    )

    expect(
      await renderToString(
        createApp({
          components: {
            ButtonComp: {
              template: `<component is="button"><slot/></component>`,
            },
          },
          template: `<ButtonComp><template v-if="false">hello</template></ButtonComp>`,
        }),
      ),
    ).toBe(`<button><!--[--><!--]--></button>`)
  })
  // what the outlet rendered is read back from the markup, before anything is
  // created on the client: `<!--(-->` is a fallback, none of the content's
  // output with it
  describe('slot fallback marker', () => {
    const render = (template: string, components: Record<string, any>) =>
      renderToString(createApp({ components, template }))
    const Child = { template: `<div><slot>fallback</slot></div>` }

    test('an outlet marks its fallback', async () => {
      const components = { Child }
      expect(await render(`<Child/>`, components)).toBe(
        `<div><!--(-->fallback<!--)--></div>`,
      )
      expect(await render(`<Child><!--c--></Child>`, components)).toBe(
        `<div><!--(-->fallback<!--)--></div>`,
      )
      expect(
        await render(`<Child><span v-if="false"/></Child>`, components),
      ).toBe(`<div><!--(-->fallback<!--)--></div>`)
      expect(await render(`<Child>content</Child>`, components)).toBe(
        `<div><!--[-->content<!--]--></div>`,
      )
    })

    test('an empty outlet without a fallback stays a plain range', async () => {
      expect(
        await render(`<Child/>`, { Child: { template: `<div><slot/></div>` } }),
      ).toBe(`<div><!--[--><!--]--></div>`)
      // a fallback that renders nothing is still the fallback
      expect(
        await render(`<Child/>`, {
          Child: {
            template: `<div><slot><template v-if="false">x</template></slot></div>`,
          },
        }),
      ).toBe(`<div><!--(--><!----><!--)--></div>`)
    })

    test('forwarded outlets keep their own ranges', async () => {
      const Wrapper = {
        components: { Child },
        template: `<Child><slot>wrapper fallback</slot></Child>`,
      }
      expect(await render(`<Wrapper/>`, { Wrapper })).toBe(
        `<div><!--[--><!--(-->wrapper fallback<!--)--><!--]--></div>`,
      )
      const Forward = {
        components: { Child },
        template: `<Child><slot/></Child>`,
      }
      expect(
        await render(`<Forward><span v-if="false"/></Forward>`, { Forward }),
      ).toBe(`<div><!--(-->fallback<!--)--></div>`)
      expect(await render(`<Forward>content</Forward>`, { Forward })).toBe(
        `<div><!--[--><!--[-->content<!--]--><!--]--></div>`,
      )
    })

    test('a transition unwraps a marked fallback like a fragment', async () => {
      const Group = {
        template: `<transition-group tag="ul"><slot/></transition-group>`,
      }
      const Mid = {
        components: { Group },
        template: `<Group><slot>fallback</slot></Group>`,
      }
      expect(await render(`<Mid/>`, { Mid })).toBe(`<ul>fallback</ul>`)
    })

    // a component without `ssrRender` (a render function, or a client-compiled
    // library component) renders its outlets as vnodes
    test('an outlet rendered as a vnode marks its fallback', async () => {
      const RenderChild = {
        render(this: any) {
          return h('div', [
            renderSlot(this.$slots, 'default', {}, () => ['fallback']),
          ])
        },
      }
      const components = { Child: RenderChild }
      expect(
        await render(`<Child><span v-if="false"/></Child>`, components),
      ).toBe(`<div><!--(-->fallback<!--)--></div>`)
      expect(await render(`<Child>content</Child>`, components)).toBe(
        `<div><!--[-->content<!--]--></div>`,
      )
      // a slot rendered as vnodes, into a template outlet
      expect(
        await renderToString(
          createApp({ render: () => h(Child, null, { default: () => [] }) }),
        ),
      ).toBe(`<div><!--(-->fallback<!--)--></div>`)
      // the fallback is told apart from a slot whose name ends like its key
      const Named = {
        render(this: any) {
          return h('div', [
            renderSlot(this.$slots, 'x_fb', {}, () => ['fallback']),
          ])
        },
      }
      expect(
        await render(`<Named><template #x_fb>content</template></Named>`, {
          Named,
        }),
      ).toBe(`<div><!--[-->content<!--]--></div>`)
    })

    // the client keeps the fragment of every vdom outlet around a vapor slot
    // as the interop does on the client: only a slot that is all the content
    // takes the fallback of an enclosing outlet
    test('an enclosing outlet keeps its fallback from content beside a forwarded vapor slot', async () => {
      const Child = {
        render(this: any) {
          return h('div', [
            renderSlot(this.$slots, 'default', {}, () => ['fallback']),
          ])
        },
      }
      const Forward = {
        components: { Child },
        template: `<Child>text<slot/></Child>`,
      }
      const Listed = {
        components: { Child },
        props: ['list'],
        template: `<Child><template v-for="i in list"><slot/></template></Child>`,
      }
      const vapor = { __vapor: true }
      const app = (components: any, template: string) =>
        renderToString(createApp({ components, template, ...vapor }))
      expect(
        await app({ Forward }, `<Forward><span v-if="false"/></Forward>`),
      ).toBe(`<div><!--[-->text<!--[--><!--]--><!--]--></div>`)
      expect(
        await app(
          { Listed },
          `<Listed :list="[1]"><span v-if="false"/></Listed>`,
        ),
      ).toBe(`<div><!--[--><!--[--><!--[--><!--]--><!--]--><!--]--></div>`)
      // an outlet given nothing beside the slot leaves an empty fragment,
      // which is no content: the slot still takes the fallback
      const Beside = {
        components: { Child },
        template: `<Child><slot/><slot name="extra"/></Child>`,
      }
      expect(
        await app({ Beside }, `<Beside><span v-if="false"/></Beside>`),
      ).toBe(`<div><!--(-->fallback<!--)--></div>`)
    })

    // a component with a client render only (a library component) forwards
    // the vapor slot as vnodes into a template outlet
    test('a template outlet marks its fallback when a vnode slot forwards an empty vapor slot', async () => {
      const Child = { template: `<div><slot><p>fallback</p></slot></div>` }
      const Forward = {
        render(this: any) {
          return h(Child, null, {
            default: () => [renderSlot(this.$slots, 'default')],
          })
        },
      }
      const vapor = { __vapor: true }
      const app = (template: string) =>
        renderToString(
          createApp({ components: { Forward }, template, ...vapor }),
        )
      expect(await app(`<Forward><span v-if="false"/></Forward>`)).toBe(
        `<div><!--(--><p>fallback</p><!--)--></div>`,
      )
      expect(await app(`<Forward>content</Forward>`)).toBe(
        `<div><!--[--><!--[-->content<!--]--><!--]--></div>`,
      )
    })

    // fallbacks are tried from the innermost outlet out, as on the client
    test('a forwarded vapor slot renders the first fallback on its chain that renders something', async () => {
      const Child = {
        render(this: any) {
          return h('div', [
            renderSlot(this.$slots, 'default', {}, () => [
              h('p', 'outer fallback'),
            ]),
          ])
        },
      }
      const Forward = {
        components: { Child },
        props: ['local'],
        template: `<Child><slot><i v-if="local">local fallback</i></slot></Child>`,
      }
      const vapor = { __vapor: true }
      const app = (template: string) =>
        renderToString(
          createApp({ components: { Forward }, template, ...vapor }),
        )
      expect(await app(`<Forward><span v-if="false"/></Forward>`)).toBe(
        `<div><!--(--><p>outer fallback</p><!--)--></div>`,
      )
      expect(
        await app(`<Forward :local="true"><span v-if="false"/></Forward>`),
      ).toBe(`<div><!--[--><!--(--><i>local fallback</i><!--)--><!--]--></div>`)
    })

    test.each([
      ['a template', { template: `<div><slot/></div>` }],
      [
        'a render function',
        {
          render(this: any) {
            return h('div', [renderSlot(this.$slots, 'default')])
          },
        },
      ],
    ])(
      'a vdom outlet (%s) keeps the range of an empty vapor slot it forwards',
      async (_, Child) => {
        const W1 = { components: { Child }, template: `<Child><slot/></Child>` }
        const W2 = { components: { W1 }, template: `<W1><slot/></W1>` }
        const template = `<W2><span v-if="false"/></W2>`
        // what the sfc compiler leaves on a vapor component
        const vapor = { __vapor: true }
        expect(
          await renderToString(
            createApp({ components: { W2 }, template, ...vapor }),
          ),
        ).toBe(`<div><!--[--><!--[--><!--[--><!--]--><!--]--><!--]--></div>`)
        // a vdom slot: left alone
        expect(await render(template, { W2 })).toBe(
          `<div><!--[--><!--]--></div>`,
        )
      },
    )

    // a render function calling the slot itself gets what the client's slots
    // proxy hands out: one vapor slot vnode, an outlet
    test('a vapor slot called directly renders as an outlet', async () => {
      const Child = {
        setup(_: any, { slots }: any) {
          return () => h('div', slots.default({ msg: 'b' }))
        },
      }
      const First = {
        setup(_: any, { slots }: any) {
          return () => slots.default({ msg: 'b' })[0]
        },
      }
      const content = `<template #default="{ msg }"><h1>a</h1><p>{{ msg }}</p></template>`
      const vapor = { __vapor: true }
      const app = (components: any, template: string) =>
        renderToString(createApp({ components, template, ...vapor }))
      expect(await app({ Child }, `<Child>${content}</Child>`)).toBe(
        `<div><!--[--><h1>a</h1><p>b</p><!--]--></div>`,
      )
      // one vnode whatever the slot renders
      expect(await app({ First }, `<First>${content}</First>`)).toBe(
        `<!--[--><h1>a</h1><p>b</p><!--]-->`,
      )
      expect(await app({ Child }, `<Child><span v-if="false"/></Child>`)).toBe(
        `<div><!--[--><!--]--></div>`,
      )
      // an ssr outlet still renders the slot itself
      expect(await app(components, `<one><h1>a</h1><p>b</p></one>`)).toBe(
        `<div><!--[--><h1>a</h1><p>b</p><!--]--></div>`,
      )
      // a vdom slot: left alone
      expect(await render(`<Child>${content}</Child>`, { Child })).toBe(
        `<div><h1>a</h1><p>b</p></div>`,
      )
    })

    // slots a vapor component hands over with `h()` are vdom slots on the
    // client: called directly, they render what they return
    test('vnode slots created in a vapor component stay vdom slots', async () => {
      const Child = {
        setup(_: any, { slots }: any) {
          return () => h('div', slots.default())
        },
      }
      const App = {
        __vapor: true,
        setup: () => ({
          view: () => h(Child, null, { default: () => h('p', 'a') }),
        }),
        template: `<component :is="view()" />`,
      }
      expect(await renderToString(createApp(App))).toBe(`<div><p>a</p></div>`)
    })
  })

  describe('slots passed to element vnodes', () => {
    const Primitive = {
      props: { as: { type: String, default: 'div' } },
      setup(props: any, { attrs, slots }: any) {
        return () => h(props.as, attrs, { default: slots.default })
      },
    }
    const render = (template: string, extra?: Record<string, any>) =>
      renderToString(
        createApp({ components: { Primitive }, template, ...extra }),
      )

    test('render compiled slots in push mode', async () => {
      expect(
        await render(
          `<Primitive as="ul" id="a"><li v-for="i in 2">{{ i }}</li><li v-if="false"/></Primitive>`,
        ),
      ).toBe(`<ul id="a"><!--[--><li>1</li><li>2</li><!--]--><!----></ul>`)

      const Functional = (_: any, { slots }: any) => h('p', slots.default)
      expect(
        await render(`<Functional>a<i>b</i></Functional>`, {
          components: { Functional },
        }),
      ).toBe(`<p>a<i>b</i></p>`)
    })

    test('nested', async () => {
      const Child = { template: `<b>{{ id }}</b>`, setup: () => ({ id: 1 }) }
      expect(
        await render(
          `<Primitive><Primitive as="span"><Child/><Primitive as="i">c</Primitive></Primitive></Primitive>`,
          { components: { Primitive, Child } },
        ),
      ).toBe(`<div><span><b>1</b><i>c</i></span></div>`)
    })

    test('cloned, async and suspended', async () => {
      const Clone = {
        setup:
          (_: any, { slots }: any) =>
          () =>
            cloneVNode(h('div', null, { default: slots.default }), { id: 'c' }),
      }
      const AsyncSetup = {
        async setup(_: any, { slots }: any) {
          await Promise.resolve()
          return () => h('div', null, { default: slots.default })
        },
      }
      const AsyncComp = defineAsyncComponent(() => Promise.resolve(Primitive))
      expect(
        await render(
          `<Clone><i>a</i></Clone>` +
            `<Suspense><AsyncSetup><i>b</i></AsyncSetup></Suspense>` +
            `<AsyncComp><i>c</i></AsyncComp>`,
          { components: { Clone, AsyncSetup, AsyncComp } },
        ),
      ).toBe(
        `<!--[--><div id="c"><i>a</i></div><div><i>b</i></div><div><i>c</i></div><!--]-->`,
      )
    })

    test('with scopeId', async () => {
      const Wrapper = {
        __scopeId: 'data-v-wrap',
        compilerOptions: { scopeId: 'data-v-wrap' },
        template: `<div><slot/></div>`,
      }
      const ScopedPrimitive = {
        __scopeId: 'data-v-prim',
        setup(_: any, { slots }: any) {
          return () => h('section', null, { default: slots.default })
        },
      }
      expect(
        await render(
          `<Primitive><i>a</i></Primitive>` +
            `<Wrapper><Primitive><Primitive as="i">b</Primitive></Primitive></Wrapper>` +
            `<Wrapper><ScopedPrimitive><i>c</i></ScopedPrimitive></Wrapper>`,
          {
            __scopeId: 'data-v-root',
            compilerOptions: { scopeId: 'data-v-root' },
            components: { Primitive, Wrapper, ScopedPrimitive },
          },
        ),
      ).toBe(
        `<!--[-->` +
          `<div data-v-root><i data-v-root>a</i></div>` +
          `<div data-v-root data-v-wrap><!--[-->` +
          `<div data-v-root data-v-wrap-s><i data-v-root data-v-wrap-s>b</i></div>` +
          `<!--]--></div>` +
          `<div data-v-root data-v-wrap><!--[-->` +
          `<section data-v-prim data-v-root data-v-wrap-s><i data-v-root data-v-wrap-s>c</i></section>` +
          `<!--]--></div>` +
          `<!--]-->`,
      )
    })

    test('compiled slots returning vnodes', async () => {
      const Parent = {
        render: () =>
          h(Primitive, null, {
            default: withCtx(() => [h('i', 'a'), createCommentVNode('c')]),
          }),
      }
      expect(await renderToString(h(Parent))).toBe(
        `<div><i>a</i><!--c--></div>`,
      )
      const TextParent = {
        render: () => h(Primitive, null, { default: withCtx(() => 'a&b') }),
      }
      expect(await renderToString(h(TextParent))).toBe(`<div>a&amp;b</div>`)
    })

    test('non-compiled slots', async () => {
      expect(
        await renderToString(h(Primitive, null, () => [h('i', 'a'), 'b'])),
      ).toBe(`<div><i>a</i>b</div>`)
      expect(await renderToString(h(Primitive, null, () => 'a'))).toBe(
        `<div>a</div>`,
      )
    })

    test('vapor slots', async () => {
      expect(
        await render(`<Primitive><h1>a</h1></Primitive>`, { __vapor: true }),
      ).toBe(`<div><!--[--><h1>a</h1><!--]--></div>`)
    })

    test('slot that throws', async () => {
      const err = new Error('slot')
      const app = createApp({
        components: { Primitive },
        template: `<Primitive><i>{{ fail() }}</i></Primitive><b>after</b>`,
        setup: () => ({
          fail: () => {
            throw err
          },
        }),
      })
      const handler = vi.fn()
      app.config.errorHandler = handler
      expect(await renderToString(app)).toBe(
        `<!--[--><div></div><b>after</b><!--]-->`,
      )
      expect(handler).toHaveBeenCalledWith(
        err,
        expect.objectContaining({ as: 'div' }),
        'render function',
      )
    })
  })
})
