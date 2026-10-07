import path from 'node:path'
import { setupPuppeteer } from './e2eUtils'

const { page, click, isChecked, nextFrame, timeout } = setupPuppeteer()
import { nextTick } from 'vue'

declare global {
  interface Window {
    Vue: typeof import('vue')
    checkboxTransitionRuns: number
  }
}

beforeEach(async () => {
  await page().addScriptTag({
    path: path.resolve(__dirname, '../../dist/vue.global.js'),
  })
  await page().setContent(`<div id="app"></div>`)
})

// #12144
test('checkbox click with v-model', async () => {
  await page().evaluate(() => {
    const { createApp } = window.Vue
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
        secondClick(this: { first: boolean }) {
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

test('does not animate an initially checked v-model checkbox inserted by conditional rendering', async () => {
  await page().evaluate(() => {
    const style = document.createElement('style')
    style.textContent = `
      input.switch {
        --thumb-position: 3px;
        --thumb-size: 20px;
        --track-size: calc(var(--thumb-size) * 2);
        display: grid;
        align-items: center;
        border: 2px solid #ddd;
        inline-size: var(--track-size);
        block-size: var(--thumb-size);
        border-radius: var(--thumb-size);
        appearance: none;
        grid: [track] 1fr / [track] 1fr;
      }
      input.switch::before {
        content: "";
        grid-area: track;
        inline-size: calc(var(--thumb-size) - 6px);
        block-size: calc(var(--thumb-size) - 6px);
        background: #ddd;
        border-radius: 50%;
        transform: translateX(var(--thumb-position));
        transition: transform 100ms linear;
      }
      input.switch:checked {
        --thumb-position: calc((var(--track-size) - 6px) - 100%);
      }
    `
    document.head.appendChild(style)

    window.checkboxTransitionRuns = 0
    document.addEventListener('transitionrun', event => {
      if (
        event.target instanceof HTMLInputElement &&
        event.target.classList.contains('switch') &&
        (event as TransitionEvent).propertyName === 'transform'
      ) {
        window.checkboxTransitionRuns++
      }
    })

    const { createApp } = window.Vue
    createApp({
      template: `
        <table>
          <tbody>
            <tr v-for="row in visibleRows" :key="row.id">
              <td>
                <label>
                  <input
                    class="switch"
                    type="checkbox"
                    :data-id="row.id"
                    v-model="row.selected"
                  />
                </label>
              </td>
            </tr>
          </tbody>
        </table>
        <ol>
          <li v-for="paginationPage in 2" :key="paginationPage">
            <span v-if="paginationPage === page">{{ paginationPage }}</span>
            <button
              v-else
              :id="'page-' + paginationPage"
              @click="page = paginationPage"
            >
              {{ paginationPage }}
            </button>
          </li>
        </ol>
      `,
      data() {
        return {
          page: 1,
          rows: [
            { id: 1, selected: true },
            { id: 2, selected: true },
            { id: 3, selected: true },
            { id: 4, selected: true },
          ],
        }
      },
      computed: {
        visibleRows(this: {
          page: number
          rows: Array<{ id: number; selected: boolean }>
        }) {
          const start = (this.page - 1) * 2
          return this.rows.slice(start, start + 2)
        },
      },
    }).mount('#app')
  })

  await click('#page-2')
  await nextFrame()
  await timeout(120)

  expect(
    await page().$$eval('input.switch', inputs =>
      inputs.map(input => (input as HTMLInputElement).checked),
    ),
  ).toEqual([true, true])
  expect(await page().evaluate(() => window.checkboxTransitionRuns)).toBe(0)
})
