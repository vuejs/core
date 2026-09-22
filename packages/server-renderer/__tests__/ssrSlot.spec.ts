import { createApp, defineAsyncComponent, h, renderSlot } from 'vue'
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
  })
})
