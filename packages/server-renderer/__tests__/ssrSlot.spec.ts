import {
  Suspense,
  createApp,
  createStaticVNode,
  defineAsyncComponent,
  h,
} from 'vue'
import { renderToString } from '../src/renderToString'
import * as runtimeDom from '@vue/runtime-dom'
import * as serverRenderer from '@vue/server-renderer'
import { compile as compileSSR } from '@vue/compiler-ssr'

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

  test('css vars on a root slot reach passed content and fallback', async () => {
    const { code: themedCode } = compileSSR(
      `<slot>fallback <span class="fb"/></slot>`,
      {
        ssrCssVars: `{ "--color": color }`,
      },
    )
    const { code: parentCode } = compileSSR(
      `<Themed><div class="passed">passed</div><i/></Themed>`,
    )
    const Themed = {
      data: () => ({ color: 'red' }),
      ssrRender: new Function('require', themedCode)((id: string) =>
        id === 'vue' ? runtimeDom : serverRenderer,
      ),
    }
    const passed = await renderToString(
      createApp({
        components: { Themed },
        ssrRender: new Function('require', parentCode)((id: string) =>
          id === 'vue' ? runtimeDom : serverRenderer,
        ),
      }),
    )
    expect(passed).toBe(
      `<!--[--><div class="passed" style="--color:red;">passed</div><i style="--color:red;"></i><!--]-->`,
    )

    const fallback = await renderToString(
      createApp({
        components: { Themed },
        template: `<Themed/>`,
      }),
    )
    expect(fallback).toBe(
      `<!--[-->fallback <span class="fb" style="--color:red;"></span><!--]-->`,
    )

    const { code: styledCode } = compileSSR(
      `<Themed><div style="color:blue">styled</div> text <br><img alt="x"></Themed>`,
    )
    const styled = await renderToString(
      createApp({
        components: { Themed },
        ssrRender: new Function('require', styledCode)((id: string) =>
          id === 'vue' ? runtimeDom : serverRenderer,
        ),
      }),
    )
    expect(styled).toBe(
      `<!--[--><div style="color:blue;--color:red;">styled</div> text <br style="--color:red;"><img alt="x" style="--color:red;"><!--]-->`,
    )
  })

  describe('css vars on a root slot', () => {
    const load = (code: string) =>
      new Function('require', code)((id: string) =>
        id === 'vue' ? runtimeDom : serverRenderer,
      )
    const Themed = {
      data: () => ({ color: 'red' }),
      ssrRender: load(
        compileSSR(`<slot><span class="fb"/></slot>`, {
          ssrCssVars: `{ "--color": color }`,
        }).code,
      ),
    }
    const render = (template: string, components: any = {}) =>
      renderToString(
        createApp({
          components: { Themed, ...components },
          ssrRender: load(compileSSR(template).code),
        }),
      )

    test('only reach the roots of compiled slot content', async () => {
      const Child = { template: `<b class="child">c</b>` }
      expect(
        await render(
          `<Themed><div class="a"><Child/><i/></div><p class="b"/></Themed>`,
          { Child },
        ),
      ).toBe(
        `<!--[--><div class="a" style="--color:red;"><b class="child">c</b><i></i></div>` +
          `<p class="b" style="--color:red;"></p><!--]-->`,
      )
    })

    test('reach the root of a component passed as slot content', async () => {
      const Child = { template: `<b class="child"><i/></b>` }
      expect(await render(`<Themed><Child/></Themed>`, { Child })).toBe(
        `<!--[--><b class="child" style="--color:red;"><i></i></b><!--]-->`,
      )
    })

    test('are not forwarded with the slot props', async () => {
      const Forwarder = {
        components: { Themed },
        ssrRender: load(
          compileSSR(
            `<Themed v-slot="p"><div class="wrap"><slot v-bind="p"/></div></Themed>`,
          ).code,
        ),
      }
      expect(
        await render(`<Forwarder><i class="leaf"/></Forwarder>`, {
          Forwarder,
        }),
      ).toBe(
        `<!--[--><div class="wrap" style="--color:red;"><!--[--><i class="leaf"></i><!--]--></div><!--]-->`,
      )
    })

    test('reach the roots of render function slot content', async () => {
      const app = createApp({
        render: () =>
          h(Themed, null, {
            default: () => [
              h(Suspense, null, { default: () => h('p', { class: 's' }) }),
              h('div', { class: 'outer' }, [h('b', { class: 'inner' })]),
            ],
          }),
      })
      expect(await renderToString(app)).toBe(
        `<!--[--><p class="s" style="--color:red;"></p>` +
          `<div class="outer" style="--color:red;"><b class="inner"></b></div><!--]-->`,
      )
    })

    test('reach the roots of hoisted static slot content', async () => {
      const app = createApp({
        render: () =>
          h(Themed, null, {
            default: () => [
              createStaticVNode(
                `<div class="a"><b class="inner">x</b></div><p class="b"></p>`,
                2,
              ),
            ],
          }),
      })
      expect(await renderToString(app)).toBe(
        `<!--[--><div class="a" style="--color:red;"><b class="inner">x</b></div>` +
          `<p class="b" style="--color:red;"></p><!--]-->`,
      )
    })

    test('reach the roots of render function slot content in nested arrays', async () => {
      const app = createApp({
        render: () =>
          h(Themed, null, {
            default: () => [
              [h('div', { class: 'a' }), h('p', { class: 'b' })],
              h('i', { class: 'c' }),
            ],
          }),
      })
      expect(await renderToString(app)).toBe(
        `<!--[--><!--[--><div class="a" style="--color:red;"></div>` +
          `<p class="b" style="--color:red;"></p><!--]-->` +
          `<i class="c" style="--color:red;"></i><!--]-->`,
      )
    })

    test('stop scanning tags at raw text content', async () => {
      const app = createApp({
        render: () =>
          h(Themed, null, {
            default: () => [
              createStaticVNode(
                `<script>if(a<b){}</script><p class="b"></p>`,
                2,
              ),
            ],
          }),
      })
      expect(await renderToString(app)).toBe(
        `<!--[--><script style="--color:red;">if(a<b){}</script>` +
          `<p class="b" style="--color:red;"></p><!--]-->`,
      )
    })

    test('match a raw text closing tag without shifting offsets', async () => {
      // `İ` lowercases to two code units, so matching a lowercased copy would
      // return offsets that do not line up with the original string
      const app = createApp({
        render: () =>
          h(Themed, null, {
            default: () => [
              createStaticVNode(`<textarea>İ</textarea><p class="b"></p>`, 2),
            ],
          }),
      })
      expect(await renderToString(app)).toBe(
        `<!--[--><textarea style="--color:red;">İ</textarea>` +
          `<p class="b" style="--color:red;"></p><!--]-->`,
      )
    })

    test('ignore a raw text close that is only a tag name prefix', async () => {
      // `</textareax>` has no delimiter after the name, so the HTML parser
      // keeps it as textarea text; the real close comes later
      const app = createApp({
        render: () =>
          h(Themed, null, {
            default: () => [
              createStaticVNode(
                `<textarea>literal </textareax><b>text</b></textarea><p class="b"></p>`,
                2,
              ),
            ],
          }),
      })
      expect(await renderToString(app)).toBe(
        `<!--[--><textarea style="--color:red;">literal </textareax><b>text</b></textarea>` +
          `<p class="b" style="--color:red;"></p><!--]-->`,
      )
    })

    test('keep a static self-closing tag self-closing', async () => {
      const app = createApp({
        render: () =>
          h(Themed, null, {
            default: () => [createStaticVNode(`<svg/>`, 1)],
          }),
      })
      expect(await renderToString(app)).toBe(
        `<!--[--><svg style="--color:red;"/><!--]-->`,
      )
    })

    test('reach the content of a root slot inside Transition', async () => {
      const ThemedTransition = {
        data: () => ({ color: 'red' }),
        ssrRender: load(
          compileSSR(`<Transition><slot/></Transition>`, {
            ssrCssVars: `{ "--color": color }`,
          }).code,
        ),
      }
      expect(
        await render(
          `<ThemedTransition><div class="a"><i/></div></ThemedTransition>`,
          {
            ThemedTransition,
          },
        ),
      ).toBe(`<div class="a" style="--color:red;"><i></i></div>`)
    })
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
})
