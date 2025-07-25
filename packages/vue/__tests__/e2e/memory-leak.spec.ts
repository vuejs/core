import { E2E_TIMEOUT, setupPuppeteer } from './e2eUtils'
import path from 'node:path'

const { page, html, click } = setupPuppeteer()

beforeEach(async () => {
  await page().setContent(`<div id="app"></div>`)
  await page().addScriptTag({
    path: path.resolve(__dirname, '../../dist/vue.global.js'),
  })
})

describe('not leaking', async () => {
  // #13661
  test(
    'cached text vnodes should not retaining detached DOM nodes',
    async () => {
      const client = await page().createCDPSession()
      await page().evaluate(async () => {
        const { createApp, ref } = (window as any).Vue
        createApp({
          components: {
            Comp1: {
              template: `
                <h1><slot></slot></h1>
                <div>{{ test.length }}</div>
            `,
              setup() {
                const test = ref([...Array(3000)].map((_, i) => ({ i })))
                // @ts-expect-error
                window.__REF__ = new WeakRef(test)

                return { test }
              },
            },
            Comp2: {
              template: `<h2>comp2</h2>`,
            },
          },
          template: `
          <button id="toggleBtn" @click="click">button</button>
          <Comp1 v-if="toggle">
            <div>
              <Comp2/>
              text node
            </div>
          </Comp1>
        `,
          setup() {
            const toggle = ref(true)
            const click = () => (toggle.value = !toggle.value)
            return { toggle, click }
          },
        }).mount('#app')
      })

      expect(await html('#app')).toBe(
        `<button id="toggleBtn">button</button>` +
          `<h1>` +
          `<div>` +
          `<h2>comp2</h2>` +
          ` text node ` +
          `</div>` +
          `</h1>` +
          `<div>3000</div>`,
      )

      await click('#toggleBtn')
      expect(await html('#app')).toBe(
        `<button id="toggleBtn">button</button><!--v-if-->`,
      )

      const isCollected = async () =>
        // @ts-expect-error
        await page().evaluate(() => window.__REF__.deref() === undefined)

      while ((await isCollected()) === false) {
        await client.send('HeapProfiler.collectGarbage')
      }

      expect(await isCollected()).toBe(true)
    },
    E2E_TIMEOUT,
  )

  // #13211
  test(
    'cached array vnodes should not retaining detached DOM nodes',
    async () => {
      const client = await page().createCDPSession()
      await page().evaluate(async () => {
        const { createApp, ref } = (window as any).Vue
        createApp({
          components: {
            Comp1: {
              template: `
                <h1><slot></slot></h1>
                <div>{{ test.length }}</div>
            `,
              setup() {
                const test = ref([...Array(3000)].map((_, i) => ({ i })))
                // @ts-expect-error
                window.__REF__ = new WeakRef(test)

                return { test }
              },
            },
          },
          template: `
          <button id="toggleBtn" @click="click">button</button>
          <Comp1 v-if="toggle">slot content</Comp1>
        `,
          setup() {
            const toggle = ref(true)
            const click = () => (toggle.value = !toggle.value)
            return { toggle, click }
          },
        }).mount('#app')
      })

      expect(await html('#app')).toBe(
        `<button id="toggleBtn">button</button>` +
          `<h1>` +
          `slot content` +
          `</h1>` +
          `<div>3000</div>`,
      )

      await click('#toggleBtn')
      expect(await html('#app')).toBe(
        `<button id="toggleBtn">button</button><!--v-if-->`,
      )

      const isCollected = async () =>
        // @ts-expect-error
        await page().evaluate(() => window.__REF__.deref() === undefined)

      while ((await isCollected()) === false) {
        await client.send('HeapProfiler.collectGarbage')
      }

      expect(await isCollected()).toBe(true)
    },
    E2E_TIMEOUT,
  )

  // https://github.com/element-plus/element-plus/issues/21408
  test(
    'cached text nodes in Fragment should not retaining detached DOM nodes',
    async () => {
      const client = await page().createCDPSession()
      await page().evaluate(async () => {
        const { createApp, ref } = (window as any).Vue
        createApp({
          components: {
            Comp: {
              template: `<div>{{ test.length }}</div>`,
              setup() {
                const test = ref([...Array(3000)].map((_, i) => ({ i })))
                // @ts-expect-error
                window.__REF__ = new WeakRef(test)

                return { test }
              },
            },
          },
          template: `
          <button id="addBtn" @click="add">add</button>
          <button id="toggleBtn" @click="click">button</button>
          <div v-if="toggle">
            <template v-for="item in items" :key="item">
              text
              <div>{{ item }}</div>
            </template>
            <Comp/>
          </div>
        `,
          setup() {
            const toggle = ref(true)
            const items = ref([1])
            const click = () => (toggle.value = !toggle.value)
            const add = () => items.value.push(2)
            return { toggle, click, items, add }
          },
        }).mount('#app')
      })

      expect(await html('#app')).toBe(
        `<button id="addBtn">add</button>` +
          `<button id="toggleBtn">button</button>` +
          `<div>` +
          ` text ` +
          `<div>1</div>` +
          `<div>3000</div></div>`,
      )

      await click('#addBtn')
      expect(await html('#app')).toBe(
        `<button id="addBtn">add</button>` +
          `<button id="toggleBtn">button</button>` +
          `<div>` +
          ` text ` +
          `<div>1</div>` +
          ` text ` +
          `<div>2</div>` +
          `<div>3000</div></div>`,
      )

      await click('#toggleBtn')
      expect(await html('#app')).toBe(
        `<button id="addBtn">add</button>` +
          `<button id="toggleBtn">button</button><!--v-if-->`,
      )

      const isCollected = async () =>
        // @ts-expect-error
        await page().evaluate(() => window.__REF__.deref() === undefined)

      while ((await isCollected()) === false) {
        await client.send('HeapProfiler.collectGarbage')
      }

      expect(await isCollected()).toBe(true)
    },
    E2E_TIMEOUT,
  )
})
