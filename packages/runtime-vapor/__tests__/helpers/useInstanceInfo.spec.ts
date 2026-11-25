import { createApp, nextTick, ref } from '@vue/runtime-dom'
import { createVaporApp, vaporInteropPlugin } from '../../src'
import { VueServerRenderer, compile, runtimeDom } from '../_utils'

const script = (vapor: boolean) => `<script setup${vapor ? ' vapor' : ''}>`
const mode = (vapor: boolean) => (vapor ? 'vapor' : 'vdom')

function mount(Comp: any, vapor: boolean) {
  const host = document.createElement('div')
  const app = vapor ? createVaporApp(Comp) : createApp(Comp)
  app.use(vaporInteropPlugin)
  app.mount(host)
  return host
}

describe('useInstanceInfo', () => {
  test('vapor component', () => {
    const seen: any[] = []
    const data = ref({ record: (...args: any[]) => seen.push(...args) })
    const components: any = {}
    const Comp = (components.Comp = compile(
      `<script setup vapor>
        import { useInstanceInfo } from 'vue'
        const data = _data
        const info = useInstanceInfo()
        data.value.record(info, info.isMounted)
      </script>
      <template>
        <div>comp</div>
      </template>`,
      data,
    ))
    const App = compile(
      `<script setup vapor>
        const components = _components
      </script>
      <template>
        <components.Comp />
      </template>`,
      data,
      components,
    )
    mount(App, true)

    const [info, mountedInSetup] = seen
    expect(info.isVapor).toBe(true)
    expect(info.type).toBe(Comp)
    expect(info.ce).toBe(null)
    expect(mountedInSetup).toBe(false)
    expect(info.isMounted).toBe(true)
  })

  test('isVapor on the server', async () => {
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(
        compile(
          `<script setup vapor>
            import { useInstanceInfo } from 'vue'
            const isVapor = String(useInstanceInfo().isVapor)
          </script>
          <template>
            <div>{{ isVapor }}</div>
          </template>`,
          ref({}),
          {},
          { vapor: true, ssr: true },
        ),
      ),
    )
    expect(html).toBe('<div>true</div>')
  })

  // vdom parent and vdom wrapper are in runtime-core
  describe('rawPropKeys', () => {
    const cases: [string, string[]][] = [
      [`<components.Wrapper />`, []],
      [`<components.Wrapper :open="false" />`, ['open']],
      [`<components.Wrapper :open="undefined" />`, ['open']],
      [
        `<components.Wrapper
          open
          @change="() => {}"
          data-x="1"
        />`,
        ['open', 'onChange', 'data-x'],
      ],
      [
        `<components.Wrapper
          key="k"
          ref="el"
          :open="false"
        />`,
        ['open'],
      ],
    ]

    function setup(parentVapor: boolean, wrapperVapor: boolean) {
      let info: any
      const data = ref({
        record: (i: any) => (info = i),
        passed: { open: false } as Record<string, any>,
      })
      const components: any = {}
      components.Wrapper = compile(
        `${script(wrapperVapor)}
          import { useInstanceInfo } from 'vue'
          const data = _data
          defineProps({ open: Boolean, label: String })
          defineEmits(['change'])
          data.value.record(useInstanceInfo())
        </script>
        <template>
          <div>wrapper</div>
        </template>`,
        data,
        components,
        { vapor: wrapperVapor },
      )
      const render = (tpl: string) => {
        mount(
          compile(
            `${script(parentVapor)}
              const data = _data
              const components = _components
            </script>
            <template>
              ${tpl}
            </template>`,
            data,
            components,
            { vapor: parentVapor },
          ),
          parentVapor,
        )
        return info
      }
      return { data, render }
    }

    for (const [parentVapor, wrapperVapor] of [
      [true, true],
      [false, true],
      [true, false],
    ]) {
      const name = `${mode(parentVapor)} parent, ${mode(wrapperVapor)} wrapper`

      test(name, () => {
        const { render } = setup(parentVapor, wrapperVapor)
        for (const [tpl, expected] of cases) {
          const info = render(tpl)
          expect(info.isVapor).toBe(wrapperVapor)
          expect(info.rawPropKeys).toEqual(expected)
        }
      })

      test(`${name}: a v-bind object follows the parent`, async () => {
        const { data, render } = setup(parentVapor, wrapperVapor)
        const info = render(`<components.Wrapper v-bind="data.passed" />`)
        expect(info.rawPropKeys).toEqual(['open'])
        data.value.passed = {}
        await nextTick()
        expect(info.rawPropKeys).toEqual([])
      })
    }
  })
})
