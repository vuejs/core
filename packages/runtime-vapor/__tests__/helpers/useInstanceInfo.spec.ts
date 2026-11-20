import { createApp, nextTick, ref } from '@vue/runtime-dom'
import { createVaporApp, vaporInteropPlugin } from '../../src'
import { VueServerRenderer, compile, runtimeDom } from '../_utils'

// one element, the elements in order for several, or null
const rootsOf = (root: ParentNode, selector: string | null) => {
  const els = selector ? Array.from(root.querySelectorAll(selector)) : []
  return els.length > 1 ? els : els[0] || null
}

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
  test('vapor component', async () => {
    const seen: any[] = []
    const data = ref({ record: (...args: any[]) => seen.push(...args) })
    const components: any = {}
    const Comp = (components.Comp = compile(
      `<script setup vapor>
        import { getCurrentInstance, onMounted, useInstanceInfo } from 'vue'
        const data = _data
        data.value.record(useInstanceInfo(), useInstanceInfo(), getCurrentInstance())
        onMounted(() => data.value.record(useInstanceInfo()))
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
    await nextTick()

    const [info, again, vdomInstance, inHook] = seen
    expect(vdomInstance).toBe(null)
    expect(info).not.toBe(null)
    expect(again).toBe(info)
    expect(inHook).toBe(info)

    expect(Object.isFrozen(info)).toBe(true)
    expect(() => {
      info.uid = -1
    }).toThrow(TypeError)

    expect(info.isVapor).toBe(true)
    expect(info.type).toBe(Comp)
    expect(info.ce).toBe(null)
    expect(typeof info.uid).toBe('number')
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
      [false, false],
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

  describe('el', () => {
    const shapes: [string, string, string | null][] = [
      ['one root', `<div class="part">part</div>`, '.part'],
      [
        'several roots',
        `<div class="a">a</div>
        <div class="b">b</div>`,
        '.a, .b',
      ],
      ['a component as the root', `<components.Inner />`, '.inner'],
      [
        'a first root that renders nothing',
        `<div v-if="false" class="a">a</div>
        <div class="b">b</div>`,
        '.b',
      ],
      ['no content', `<div v-if="false" class="part">part</div>`, null],
      // enough static nodes to compile into one static vnode in vdom
      [
        'text before static elements',
        `lead${'<span>x</span>'.repeat(20)}`,
        'span',
      ],
    ]
    for (const vapor of [true, false]) {
      for (const [name, template, selector] of shapes) {
        test(`${mode(vapor)} component mounted on the client: ${name}`, async () => {
          const seen: Record<string, any> = {}
          const data = ref({
            record: (phase: string, i: any) =>
              (seen[phase] = { isHydrating: i.isHydrating, el: i.el }),
          })
          const components: any = {}
          components.Inner = compile(
            `${script(vapor)}
              const data = _data
            </script>
            <template>
              <div class="inner">inner</div>
            </template>`,
            data,
            components,
            { vapor },
          )
          components.Part = compile(
            `${script(vapor)}
              import { onMounted, useInstanceInfo } from 'vue'
              const data = _data
              const components = _components
              const info = useInstanceInfo()
              data.value.record('setup', info)
              onMounted(() => data.value.record('mounted', info))
            </script>
            <template>
              ${template}
            </template>`,
            data,
            components,
            { vapor },
          )
          const App = compile(
            `${script(vapor)}
              const components = _components
            </script>
            <template>
              <main>
                <components.Part />
              </main>
            </template>`,
            data,
            components,
            { vapor },
          )
          const host = mount(App, vapor)
          await nextTick()
          expect(seen.setup).toEqual({ isHydrating: false, el: null })
          expect(seen.mounted).toEqual({
            isHydrating: false,
            el: rootsOf(host, selector),
          })
        })
      }
    }
  })
})
