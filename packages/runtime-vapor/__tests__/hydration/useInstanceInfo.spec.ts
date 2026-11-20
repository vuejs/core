import { nextTick, ref, setIsHydratingEnabled } from '@vue/runtime-dom'
import { createVaporSSRApp, vaporInteropPlugin } from '../../src'
import { VueServerRenderer, compile, runtimeDom } from '../_utils'
import { setupHydrationTest, testHydration } from './_helpers'

setupHydrationTest()

const script = (vapor: boolean) => `<script setup${vapor ? ' vapor' : ''}>`
const mode = (vapor: boolean) => (vapor ? 'vapor' : 'vdom')

type Seen = { isHydrating: boolean; el: Node | Node[] | null }

// one element, the elements in order for several, or null
const rootsOf = (root: ParentNode, selector: string | null) => {
  const els = selector ? Array.from(root.querySelectorAll(selector)) : []
  return els.length > 1 ? els : els[0] || null
}

const snap = (info: any): Seen => ({
  isHydrating: info.isHydrating,
  el: info.el,
})

function setup(
  appVapor: boolean,
  partVapor: boolean,
  partTemplate: string,
  slotContent = '',
) {
  const seen: Record<string, Seen> = {}
  let info: any
  const data = ref({
    show: true,
    record(phase: string, i: any) {
      seen[phase] = snap((info = i))
    },
    read(phase: string) {
      seen[phase] = snap(info)
      return ''
    },
  })
  const serverData = ref({ show: true, record() {}, read: () => '' })
  const app = `${script(appVapor)}
      const data = _data
      const components = _components
    </script>
    <template>
      <main>
        <span>before</span>
        <components.Part v-if="data.show">${slotContent}</components.Part>
        <span>after</span>
      </main>
    </template>`
  const part = {
    code: `${script(partVapor)}
        import { onMounted, useInstanceInfo } from 'vue'
        const data = _data
        const components = _components
        const info = useInstanceInfo()
        data.value.record('setup', info)
        onMounted(() => data.value.record('mounted', info))
      </script>
      <template>${partTemplate}</template>`,
    vapor: partVapor,
  }
  const inner = {
    code: `${script(partVapor)}
        const data = _data
      </script>
      <template>
        <div class="inner">inner</div>
      </template>`,
    vapor: partVapor,
  }
  const hydrate = (show = true) => {
    data.value.show = serverData.value.show = show
    return testHydration(app, { Inner: inner, Part: part }, data, {
      isVaporApp: appVapor,
      interop: appVapor !== partVapor,
      serverData,
    })
  }
  return { seen, data, serverData, app, part, hydrate }
}

describe('useInstanceInfo during hydration', () => {
  for (const [appVapor, partVapor] of [
    [true, true],
    [false, false],
    [false, true],
    [true, false],
  ]) {
    describe(`${mode(appVapor)} app, ${mode(partVapor)} part`, () => {
      test('el read while the component renders', async () => {
        const { seen, hydrate } = setup(
          appVapor,
          partVapor,
          `<div class="part">
            <span>{{ data.read('render') }}</span>
          </div>`,
        )
        const { container } = await hydrate()
        expect(seen.render).toEqual({
          isHydrating: true,
          el: container.querySelector('.part'),
        })
      })

      test('a component mounted after hydration', async () => {
        const { seen, data, hydrate } = setup(
          appVapor,
          partVapor,
          `<div class="part">part</div>`,
        )
        const { container } = await hydrate(false)
        expect(seen.setup).toBeUndefined()
        data.value.show = true
        await nextTick()
        expect(seen.setup).toEqual({ isHydrating: false, el: null })
        expect(seen.mounted).toEqual({
          isHydrating: false,
          el: container.querySelector('.part'),
        })
      })

      // the same elements while hydrating and once mounted: the root
      // elements the component renders, past every marker comment
      const shapes: [string, string, string | null, string?][] = [
        ['one root', `<div class="part">part</div>`, '.part'],
        [
          'several roots',
          `<div class="a">a</div>
          <div class="b">b</div>`,
          '.a, .b',
        ],
        ['a component as the root', `<components.Inner />`, '.inner'],
        [
          'a slot as the root',
          `<slot />`,
          '.slotted',
          `<div class="slotted">s</div>`,
        ],
        [
          'a slot with several elements as the root',
          `<slot />`,
          '.slotted',
          `<div class="slotted">a</div>
          <div class="slotted">b</div>`,
        ],
        [
          'a first root that renders nothing',
          `<div v-if="false" class="a">a</div>
          <div class="b">b</div>`,
          '.b',
        ],
        ['no content', `<div v-if="false" class="part">part</div>`, null],
      ]
      for (const [name, template, selector, slotContent] of shapes) {
        test(name, async () => {
          const { seen, hydrate } = setup(
            appVapor,
            partVapor,
            template,
            slotContent,
          )
          const { container } = await hydrate()
          const el = rootsOf(container, selector)
          if (selector) expect(el).not.toBe(null)
          expect(seen.setup).toEqual({ isHydrating: true, el })
          expect(seen.mounted).toEqual({ isHydrating: false, el })
          expect(`mismatch`).not.toHaveBeenWarned()
        })
      }
    })
  }

  // A client bundle that hydrates through createVaporSSRApp alone never calls
  // createSSRApp, which is what switches vdom hydration on.
  test('vdom part in a vapor app that creates no vdom SSR app', async () => {
    const { seen, data, serverData, app, part } = setup(
      true,
      false,
      `<div class="part">part</div>`,
    )
    const build = (data: any, ssr: boolean) =>
      compile(
        app,
        data,
        { Part: compile(part.code, data, {}, { vapor: false, ssr }) },
        { vapor: true, ssr },
      )
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(build(serverData, true)),
    )

    setIsHydratingEnabled(false)
    try {
      createVaporSSRApp(build(data, false))
        .use(vaporInteropPlugin)
        .mount(container)
    } finally {
      setIsHydratingEnabled(true)
    }
    const el = container.querySelector('.part')
    expect(el).not.toBe(null)
    expect(seen.setup).toEqual({ isHydrating: true, el })
    expect(seen.mounted).toEqual({ isHydrating: false, el })
  })

  test('a Suspense root whose async child is still pending', async () => {
    const seen: Record<string, Seen> = {}
    let resolve!: () => void
    const data = ref({
      wait: new Promise<void>(r => (resolve = r)),
      record: (phase: string, info: any) => (seen[phase] = snap(info)),
    })
    const { container } = await testHydration(
      `<script setup>
        import { onMounted, useInstanceInfo } from 'vue'
        const data = _data
        const components = _components
        const info = useInstanceInfo()
        data.value.record('setup', info)
        onMounted(() => data.value.record('mounted', info))
      </script>
      <template>
        <Suspense>
          <components.Async />
        </Suspense>
      </template>`,
      {
        Async: {
          code: `<script setup>
            const data = _data
            await data.value.wait
          </script>
          <template>
            <div class="async">async</div>
          </template>`,
          vapor: false,
        },
      },
      data,
      {
        isVaporApp: false,
        serverData: ref({ wait: Promise.resolve(), record() {} }),
      },
    )
    const el = container.querySelector('.async')
    expect(el).not.toBe(null)
    expect(seen.setup).toEqual({ isHydrating: true, el })
    // the component is mounted while its Suspense still waits
    expect(seen.mounted).toEqual({ isHydrating: false, el })
    resolve()
    await new Promise(r => setTimeout(r))
    await nextTick()
    expect(container.querySelector('.async')).toBe(el)
  })
})
