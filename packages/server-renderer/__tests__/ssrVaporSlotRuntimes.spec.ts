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
})
