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

  test('transition slot fallback', async () => {
    // the client unwraps the transition child, so a fallback that renders a
    // fragment (v-for) must not be wrapped in fragment markers here
    const ReusableTransition = {
      template: `<transition><slot><div v-for="i in 3">{{ i }}</div></slot></transition>`,
    }

    expect(await renderToString(createApp(ReusableTransition))).toBe(
      `<div>1</div><div>2</div><div>3</div>`,
    )

    expect(
      await renderToString(
        createApp({
          components: {
            one: ReusableTransition,
          },
          template: `<one><div>hi</div></one>`,
        }),
      ),
    ).toBe(`<div>hi</div>`)
  })

  test('transition-group slot fallback with a falsy v-if', async () => {
    // transition-group filters comment children out at runtime, so a fallback
    // whose only child is a falsy `v-if` must not leave a placeholder comment
    // in the server output - the client renders none
    const ReusableList = {
      setup: () => ({ shown: false }),
      template: `<TransitionGroup tag="ul"><slot><li v-if="shown">a</li></slot></TransitionGroup>`,
    }

    expect(await renderToString(createApp(ReusableList))).toBe(`<ul></ul>`)

    expect(
      await renderToString(
        createApp({
          components: { one: ReusableList },
          template: `<one><li>a</li></one>`,
        }),
      ),
    ).toBe(`<ul><li>a</li></ul>`)
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
})
