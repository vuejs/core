import path from 'node:path'
import { setupPuppeteer } from './e2eUtils'

const { page, click, isChecked, html } = setupPuppeteer()
import { nextTick } from 'vue'

beforeEach(async () => {
  await page().addScriptTag({
    path: path.resolve(__dirname, '../../dist/vue.global.js'),
  })
  await page().setContent(`<div id="app"></div>`)
})

// #8638
test('checkbox click with v-model array', async () => {
  await page().evaluate(() => {
    const { createApp, ref } = (window as any).Vue
    createApp({
      template: `
      {{cls}}
      <input
        id="checkEl"
        type="checkbox"
        @click="change"
        v-model="inputModel"
        value="a"
      >
        `,
      setup() {
        const inputModel = ref([])
        const count = ref(0)
        const change = () => {
          count.value++
        }
        return {
          inputModel,
          change,
          cls: count,
        }
      },
    }).mount('#app')
  })

  expect(await isChecked('#checkEl')).toBe(false)
  expect(await html('#app')).toMatchInlineSnapshot(
    `"0 <input id="checkEl" type="checkbox" value="a">"`,
  )

  await click('#checkEl')
  await nextTick()
  expect(await isChecked('#checkEl')).toBe(true)
  expect(await html('#app')).toMatchInlineSnapshot(
    `"1 <input id="checkEl" type="checkbox" value="a">"`,
  )

  await click('#checkEl')
  await nextTick()
  expect(await isChecked('#checkEl')).toBe(false)
  expect(await html('#app')).toMatchInlineSnapshot(
    `"2 <input id="checkEl" type="checkbox" value="a">"`,
  )
})
