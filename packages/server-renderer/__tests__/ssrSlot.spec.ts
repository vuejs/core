import { createApp, defineAsyncComponent, h } from 'vue'
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
    ).toBe(`<div><!--[-->fallback<!--]--></div>`)

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
  // A vapor client reads what the outlet left behind instead of guessing:
  // `<!--(-->` is a rendered fallback, none of the content's output with it.
  describe('fallback marker for vapor', () => {
    // what the sfc compiler leaves on a vapor component
    const vapor = { __vapor: true }
    const render = (template: string, components: Record<string, any>) =>
      renderToString(createApp({ components, template, ...vapor }))

    const VaporChild = {
      template: `<div><slot>fallback</slot></div>`,
      ...vapor,
    }
    const VdomChild = { template: `<div><slot>fallback</slot></div>` }

    test('an outlet in a vapor component marks its fallback', async () => {
      const components = { Child: VaporChild }
      expect(await render(`<Child/>`, components)).toBe(
        `<div><!--(-->fallback<!--)--></div>`,
      )
      expect(await render(`<Child><!--c--></Child>`, components)).toBe(
        `<div><!--(-->fallback<!--)--></div>`,
      )
      expect(await render(`<Child>content</Child>`, components)).toBe(
        `<div><!--[-->content<!--]--></div>`,
      )
    })

    test('whoever provides the slot', async () => {
      expect(
        await renderToString(
          createApp({
            components: { Child: VaporChild },
            template: `<Child><span v-if="false"/></Child>`,
          }),
        ),
      ).toBe(`<div><!--(-->fallback<!--)--></div>`)
    })

    test('an outlet written in a vapor component, forwarded into a vdom one', async () => {
      // it renders in the slot of the vdom component, which is not the one it
      // is written in
      const Wrapper = {
        components: { Child: VdomChild },
        template: `<Child><slot>wrapper fallback</slot></Child>`,
        ...vapor,
      }
      expect(
        await renderToString(
          createApp({ components: { Wrapper }, template: `<Wrapper/>` }),
        ),
      ).toBe(`<div><!--[--><!--(-->wrapper fallback<!--)--><!--]--></div>`)
    })

    test('an empty outlet without a fallback stays a plain range', async () => {
      expect(
        await render(`<Child/>`, {
          Child: { template: `<div><slot/></div>`, ...vapor },
        }),
      ).toBe(`<div><!--[--><!--]--></div>`)
    })

    test('an outlet in a vdom component marks its fallback when it drops a vapor slot', async () => {
      const components = { Child: VdomChild }
      // rendered directly
      expect(
        await render(`<Child><span v-if="false"/></Child>`, components),
      ).toBe(`<div><!--(-->fallback<!--)--></div>`)
      // forwarded by a vdom component
      const Wrapper = { components, template: `<Child><slot/></Child>` }
      expect(
        await render(`<Wrapper><span v-if="false"/></Wrapper>`, { Wrapper }),
      ).toBe(`<div><!--(-->fallback<!--)--></div>`)
      expect(await render(`<Wrapper>content</Wrapper>`, { Wrapper })).toBe(
        `<div><!--[--><!--[-->content<!--]--><!--]--></div>`,
      )
    })

    test('an outlet in a vdom component with vdom content is left alone', async () => {
      const components = { Child: VdomChild }
      const app = (template: string) =>
        renderToString(createApp({ components, template }))
      expect(await app(`<Child/>`)).toBe(`<div><!--[-->fallback<!--]--></div>`)
      expect(await app(`<Child><span v-if="false"/></Child>`)).toBe(
        `<div><!--[-->fallback<!--]--></div>`,
      )
      // no slot passed at all: nothing vapor was dropped
      expect(await render(`<Child/>`, components)).toBe(
        `<div><!--[-->fallback<!--]--></div>`,
      )
    })

    test('a transition unwraps a marked fallback like a fragment', async () => {
      const Group = {
        template: `<transition-group tag="ul"><slot/></transition-group>`,
      }
      const Forward = {
        components: { Group, Child: VaporChild },
        template: `<Group><Child/></Group>`,
      }
      expect(await render(`<Forward/>`, { Forward })).toBe(
        `<ul><div><!--(-->fallback<!--)--></div></ul>`,
      )
    })
  })
})
