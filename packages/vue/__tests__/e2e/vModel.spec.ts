import path from 'node:path'
import { setupPuppeteer } from './e2eUtils'

const { page, click, isChecked } = setupPuppeteer()
import { nextTick } from 'vue'

beforeEach(async () => {
  await page().addScriptTag({
    path: path.resolve(__dirname, '../../dist/vue.global.js'),
  })
  await page().setContent(`<div id="app"></div>`)
})

// #12144
test('checkbox click with v-model', async () => {
  await page().evaluate(() => {
    const { createApp } = (window as any).Vue
    createApp({
      template: `
      <label>
        <input 
          id="first"
          type="checkbox"
          v-model="first"/>
        First
      </label>
      <br>  
      <label>
        <input
          id="second"
          type="checkbox"
          v-model="second"      
          @click="secondClick"/>    
          Second
      </label> 
        `,
      data() {
        return {
          first: true,
          second: false,
        }
      },
      methods: {
        secondClick(this: any) {
          this.first = false
        },
      },
    }).mount('#app')
  })

  expect(await isChecked('#first')).toBe(true)
  expect(await isChecked('#second')).toBe(false)
  await click('#second')
  await nextTick()
  expect(await isChecked('#first')).toBe(false)
  expect(await isChecked('#second')).toBe(true)
})
