import * as Vue from '../src'
import { createApp, reactive, onMounted } from '../src'
import { nextTick } from '../../runtime-test/src'
;(window as any).Vue = Vue
const click = jest.fn()

test('render new items added', async () => {
  const container = document.createElement('div')
  const App = {
    template: `<div>
        <button @click="addItem()" id="test-button"> AddToList </button>
  
        <ul>
          <li v-for="(item, index) in testList" :key="index"> 
            {{ item }}
          </li>
        </ul>
      </div>
      `,

    setup() {
      const testList = reactive([1])

      function addItem() {
        const number = Number(testList.length) + 1
        testList.push(number)
        click()
      }

      onMounted(() => {
        addItem()
      })

      return {
        testList,
        addItem
      }
    }
  }
  createApp().mount(App, container)
  await nextTick()
  let text = container!.querySelector('ul')!.innerHTML

  expect(text).toBe('<!----><li>1</li><li>2</li><!---->')
})
