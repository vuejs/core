import { createSSRApp } from 'vue'
import { renderToString } from '../src/renderToString'

const gc = () =>
  new Promise<void>(resolve => {
    setTimeout(() => {
      global.gc!()
      resolve()
    })
  })

const Card = {
  props: { tag: { type: String, default: 'div' } },
  template: `<component :is="tag" class="card"><slot /></component>`,
}

const Page = {
  components: { Card },
  props: ['payload'],
  template: `<main><Card>{{ payload.title }}</Card></main>`,
}

describe.skipIf(!global.gc)('ssr: render error leak', () => {
  // #15070
  test('should GC apps created after a render error in a forwarded slot', async () => {
    const createApp = (payload: any) => createSSRApp(Page, { payload })

    expect(await renderToString(createApp({ title: 'ok' }))).toContain('ok')

    await expect(renderToString(createApp(null))).rejects.toThrow(
      `Cannot read properties of null`,
    )

    const weakRefs: { deref(): unknown | undefined }[] = []
    const renderOnce = async () => {
      const app = createApp({ title: 'ok' })
      // @ts-expect-error ES2021 API
      weakRefs.push(new WeakRef(app))
      expect(await renderToString(app)).toContain('ok')
    }
    for (let i = 0; i < 20; i++) {
      await renderOnce()
    }

    for (let i = 0; i < 5; i++) {
      await gc()
    }

    expect(weakRefs.filter(ref => ref.deref()).length).toBe(0)
  })

  test('should GC apps created after a render error in an inline block (`v-if`)', async () => {
    const PageIf = {
      props: ['payload'],
      template: `<component :is="'div'"><div v-if="payload.list">{{ payload.list.missing.x }}</div></component>`,
    }
    const createApp = (payload: any) => createSSRApp(PageIf, { payload })

    expect(
      await renderToString(createApp({ list: { missing: { x: 'ok' } } })),
    ).toContain('ok')

    await expect(renderToString(createApp({ list: {} }))).rejects.toThrow(
      `Cannot read properties of undefined`,
    )

    const weakRefs: { deref(): unknown | undefined }[] = []
    const renderOnce = async () => {
      const app = createApp({ list: { missing: { x: 'ok' } } })
      // @ts-expect-error ES2021 API
      weakRefs.push(new WeakRef(app))
      expect(await renderToString(app)).toContain('ok')
    }
    for (let i = 0; i < 20; i++) {
      await renderOnce()
    }

    for (let i = 0; i < 5; i++) {
      await gc()
    }

    expect(weakRefs.filter(ref => ref.deref()).length).toBe(0)
  })
})
