import { compileScript, parse } from '@vue/compiler-sfc'

// The SFC playground loads the browser bundles of `vue` and
// `vue/server-renderer` separately: the server renderer renders with a runtime
// copy of its own, while the app's components run on the other one.
async function loadRuntimes() {
  vi.resetModules()
  const ssr = await import('@vue/server-renderer')
  vi.resetModules()
  const vue = await import('vue')
  return { ssr, vue }
}

// a vapor SFC compiled for SSR against the given runtime copies
function compileVaporSSR(
  sfc: string,
  vue: any,
  ssr: any,
  components: Record<string, any>,
): any {
  const { descriptor } = parse(sfc)
  const code =
    compileScript(descriptor, {
      id: 'x',
      isProd: true,
      inlineTemplate: true,
      vapor: true,
      genDefaultAs: '__sfc__',
      templateOptions: { ssr: true },
    })
      .content.replace(/\bimport {/g, 'const {')
      .replace(/ as _/g, ': _')
      .replace(/} from ['"]vue['"]/g, '} = Vue')
      .replace(/} from "vue\/server-renderer"/g, '} = VueServerRenderer') +
    '\nreturn __sfc__'
  return new Function('Vue', 'VueServerRenderer', '_components', code)(
    vue,
    ssr,
    components,
  )
}

describe('ssr: vapor slots across runtime copies', () => {
  test.each([
    ['returned as is', (h: any, slots: any) => slots.default()[0]],
    // Nuxt's NuxtPage forwards the slot vnode through `h(vnode)`, a clone
    ['forwarded through h()', (h: any, slots: any) => h(slots.default()[0])],
  ])('a vdom child renders the slot %s', async (_, render) => {
    const { ssr, vue } = await loadRuntimes()
    const Wrapper = {
      setup(_: any, { slots }: any) {
        return () => render(vue.h, slots)
      },
    }
    const App = compileVaporSSR(
      `<script setup vapor>
      const Wrapper = _components.Wrapper
      </script>
      <template>
        <Wrapper><p>hello</p></Wrapper>
      </template>`,
      vue,
      ssr,
      { Wrapper },
    )
    expect(await ssr.renderToString(vue.createSSRApp(App))).toBe(
      `<!--[--><p>hello</p><!--]-->`,
    )
  })

  // content that is not cloned, or cloned without attrs, renders the slot as
  // an ssr outlet does: no props to merge
  test.each([
    ['as is', (vue: any, slots: any) => slots.default()[0]],
    [
      'cloned without attrs',
      (vue: any, slots: any) => vue.cloneVNode(slots.default()[0]),
    ],
  ])('a vdom child renders the slot %s without merging', async (_, render) => {
    const { ssr, vue } = await loadRuntimes()
    const mergeProps = vi.spyOn(vue, 'mergeProps')
    const Wrapper = {
      setup(_: any, { slots }: any) {
        return () => render(vue, slots)
      },
    }
    const App = compileVaporSSR(
      `<script setup vapor>
      const Wrapper = _components.Wrapper
      </script>
      <template>
        <Wrapper>
          <button class="a" style="color: red" disabled>open</button>
        </Wrapper>
      </template>`,
      { ...vue, mergeProps },
      ssr,
      { Wrapper },
    )
    expect(await ssr.renderToString(vue.createSSRApp(App))).toBe(
      `<!--[-->` +
        `<button class="a" style="color:red;" disabled>open</button>` +
        `<!--]-->`,
    )
    expect(mergeProps).not.toHaveBeenCalled()
  })

  // #16269
  test('a vdom child renders what it clones onto the slot content', async () => {
    const { ssr, vue } = await loadRuntimes()
    const AsChild = {
      setup(_: any, { slots }: any) {
        return () =>
          vue.cloneVNode(slots.default()[0], {
            class: 'trigger',
            style: { color: 'red' },
            'aria-expanded': 'false',
            onClick: () => {},
          })
      },
    }
    const App = compileVaporSSR(
      `<script setup vapor>
      const AsChild = _components.AsChild
      const cls = 'own'
      </script>
      <template>
        <AsChild>
          <button :class="cls" style="font-size: 12px">open</button>
        </AsChild>
      </template>`,
      vue,
      ssr,
      { AsChild },
    )
    expect(await ssr.renderToString(vue.createSSRApp(App))).toBe(
      `<!--[-->` +
        `<button class="own trigger" style="font-size:12px;color:red;" aria-expanded="false">open</button>` +
        `<!--]-->`,
    )
  })
})
