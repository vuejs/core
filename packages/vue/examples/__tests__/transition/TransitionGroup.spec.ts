import { E2E_TIMEOUT, setupPuppeteer } from '../e2eUtils'
import path from 'path'
import { mockWarn } from '@vue/shared'
import { createApp, ref } from 'vue'

describe('e2e: TransitionGroup', () => {
  mockWarn()
  const { page, html } = setupPuppeteer()
  const baseUrl = `file://${path.resolve(
    __dirname,
    '../../transition/index.html'
  )}`

  const duration = 50
  const buffer = 10

  const htmlWhenTransitionStart = () =>
    page().evaluate(() => {
      (document.querySelector('#toggleBtn') as any)!.click()
      return Promise.resolve().then(() => {
        return document.querySelector('#container')!.innerHTML
      })
    })

  const transitionFinish = (time = duration) =>
    new Promise(r => {
      setTimeout(r, time + buffer)
    })

  const nextFrame = () => {
    return page().evaluate(() => {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve)
        })
      })
    })
  }

  beforeEach(async () => {
    await page().goto(baseUrl)
    await page().waitFor('#app')
  })

  test(
    'enter',
    async () => {
      await page().evaluate(() => {
        const { createApp, ref } = (window as any).Vue
        createApp({
          template: `
              <div id="container">
								<transition-group name="test">
									<div v-for="item in items" :key="item" class="test">{{item}}</div>
								</transition-group>
							</div>
              <button id="toggleBtn" @click="click">button</button>
            `,
          setup: () => {
            const items = ref(['a', 'b', 'c'])
            const click = () => items.value.push('d', 'e')
            return { click, items }
          }
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`
      )

      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-from">d</div>` +
          `<div class="test test-enter-active test-enter-from">e</div>`
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<div class="test test-enter-active test-enter-to">e</div>`
      )
      await transitionFinish()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test">d</div>` +
          `<div class="test">e</div>`
      )
    },
    E2E_TIMEOUT
  )

  test(
    'leave',
    async () => {
      await page().evaluate(() => {
        const { createApp, ref } = (window as any).Vue
        createApp({
          template: `
              <div id="container">
								<transition-group name="test">
									<div v-for="item in items" :key="item" class="test">{{item}}</div>
								</transition-group>
							</div>
              <button id="toggleBtn" @click="click">button</button>
            `,
          setup: () => {
            const items = ref(['a', 'b', 'c'])
            const click = () => (items.value = ['b'])
            return { click, items }
          }
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`
      )

      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test test-leave-active test-leave-from">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test test-leave-active test-leave-from">c</div>`
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test test-leave-active test-leave-to">c</div>`
      )
      await transitionFinish()
      expect(await html('#container')).toBe(`<div class="test">b</div>`)
    },
    E2E_TIMEOUT
  )

  test(
    'enter + leave',
    async () => {
      await page().evaluate(() => {
        const { createApp, ref } = (window as any).Vue
        createApp({
          template: `
              <div id="container">
								<transition-group name="test">
									<div v-for="item in items" :key="item" class="test">{{item}}</div>
								</transition-group>
							</div>
              <button id="toggleBtn" @click="click">button</button>
            `,
          setup: () => {
            const items = ref(['a', 'b', 'c'])
            const click = () => (items.value = ['b', 'c', 'd'])
            return { click, items }
          }
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`
      )

      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test test-leave-active test-leave-from">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-from">d</div>`
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>`
      )
      await transitionFinish()
      expect(await html('#container')).toBe(
        `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test">d</div>`
      )
    },
    E2E_TIMEOUT
  )

  test(
    'appear',
    async () => {
      const appearHtml = await page().evaluate(() => {
        const { createApp, ref } = (window as any).Vue
        createApp({
          template: `
              <div id="container">
								<transition-group appear
										appear-from-class="test-appear-from"
										appear-to-class="test-appear-to"
										appear-active-class="test-appear-active"
										name="test">
									<div v-for="item in items" :key="item" class="test">{{item}}</div>
								</transition-group>
							</div>
              <button id="toggleBtn" @click="click">button</button>
            `,
          setup: () => {
            const items = ref(['a', 'b', 'c'])
            const click = () => items.value.push('d', 'e')
            return { click, items }
          }
        }).mount('#app')
        return Promise.resolve().then(() => {
          return document.querySelector('#container')!.innerHTML
        })
      })
      // appear
      expect(appearHtml).toBe(
        `<div class="test test-appear-active test-appear-from">a</div>` +
          `<div class="test test-appear-active test-appear-from">b</div>` +
          `<div class="test test-appear-active test-appear-from">c</div>`
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test test-appear-active test-appear-to">a</div>` +
          `<div class="test test-appear-active test-appear-to">b</div>` +
          `<div class="test test-appear-active test-appear-to">c</div>`
      )
      await transitionFinish()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`
      )

      // enter
      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-from">d</div>` +
          `<div class="test test-enter-active test-enter-from">e</div>`
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<div class="test test-enter-active test-enter-to">e</div>`
      )
      await transitionFinish()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test">d</div>` +
          `<div class="test">e</div>`
      )
    },
    E2E_TIMEOUT
  )

  test(
    'move',
    async () => {
      await page().evaluate(() => {
        const { createApp, ref } = (window as any).Vue
        createApp({
          template: `
              <div id="container">
								<transition-group name="group">
									<div v-for="item in items" :key="item" class="test">{{item}}</div>
								</transition-group>
							</div>
              <button id="toggleBtn" @click="click">button</button>
            `,
          setup: () => {
            const items = ref(['a', 'b', 'c'])
            const click = () => (items.value = ['d', 'b', 'a'])
            return { click, items }
          }
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`
      )

      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test group-enter-active group-enter-from">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-active group-leave-from group-move" style="">c</div>`
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test group-enter-active group-enter-to">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-active group-move group-leave-to" style="">c</div>`
      )
      await transitionFinish()
      expect(await html('#container')).toBe(
        `<div class="test">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test" style="">a</div>`
      )
    },
    E2E_TIMEOUT
  )

  test(
    'dynamic name',
    async () => {
      await page().evaluate(() => {
        const { createApp, ref } = (window as any).Vue
        createApp({
          template: `
              <div id="container">
								<transition-group :name="name">
									<div v-for="item in items" :key="item" >{{item}}</div>
								</transition-group>
							</div>
              <button id="toggleBtn" @click="click">button</button>
              <button id="changeNameBtn" @click="changeName">button</button>
					`,
          setup: () => {
            const items = ref(['a', 'b', 'c'])
            const name = ref('invalid')
            const click = () => (items.value = ['b', 'c', 'a'])
            const changeName = () => {
              name.value = 'group'
              items.value = ['a', 'b', 'c']
            }
            return { click, items, name, changeName }
          }
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        `<div>a</div>` + `<div>b</div>` + `<div>c</div>`
      )

      // invalid name
      expect(await htmlWhenTransitionStart()).toBe(
        `<div>b</div>` + `<div>c</div>` + `<div>a</div>`
      )
      // change name
      const moveHtml = await page().evaluate(() => {
        ;(document.querySelector('#changeNameBtn') as any).click()
        return Promise.resolve().then(() => {
          return document.querySelector('#container')!.innerHTML
        })
      })
      expect(moveHtml).toBe(
        `<div class="group-move" style="">a</div>` +
          `<div class="group-move" style="">b</div>` +
          `<div class="group-move" style="">c</div>`
      )
      await transitionFinish(100)
      expect(await html('#container')).toBe(
        `<div class="" style="">a</div>` +
          `<div class="" style="">b</div>` +
          `<div class="" style="">c</div>`
      )
    },
    E2E_TIMEOUT
  )

  test.todo('events')

  test('warn unkeyed children', () => {
    createApp({
      template: `
        <transition-group name="test">
          <div v-for="item in items" class="test">{{item}}</div>
        </transition-group>
            `,
      setup: () => {
        const items = ref(['a', 'b', 'c'])
        return { items }
      }
    }).mount(document.createElement('div'))

    expect(`<TransitionGroup> children must be keyed`).toHaveBeenWarned()
  })
})
