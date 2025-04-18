import { E2E_TIMEOUT, setupPuppeteer } from './e2eUtils'
import path from 'node:path'
import { createApp, ref } from 'vue'

describe('e2e: TransitionGroup', () => {
  const { page, html, nextFrame, timeout } = setupPuppeteer()
  const baseUrl = `file://${path.resolve(__dirname, './transition.html')}`

  const duration = process.env.CI ? 200 : 50
  const buffer = process.env.CI ? 20 : 5

  const htmlWhenTransitionStart = () =>
    page().evaluate(() => {
      ;(document.querySelector('#toggleBtn') as any)!.click()
      return Promise.resolve().then(() => {
        return document.querySelector('#container')!.innerHTML
      })
    })

  const transitionFinish = (time = duration) => timeout(time + buffer)

  beforeEach(async () => {
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
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
          },
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-from test-enter-active">d</div>` +
          `<div class="test test-enter-from test-enter-active">e</div>`,
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<div class="test test-enter-active test-enter-to">e</div>`,
      )
      await transitionFinish()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test">d</div>` +
          `<div class="test">e</div>`,
      )
    },
    E2E_TIMEOUT,
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
          },
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test test-leave-from test-leave-active">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test test-leave-from test-leave-active">c</div>`,
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test test-leave-active test-leave-to">c</div>`,
      )
      await transitionFinish()
      expect(await html('#container')).toBe(`<div class="test">b</div>`)
    },
    E2E_TIMEOUT,
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
          },
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test test-leave-from test-leave-active">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-from test-enter-active">d</div>`,
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>`,
      )
      await transitionFinish()
      expect(await html('#container')).toBe(
        `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test">d</div>`,
      )
    },
    E2E_TIMEOUT,
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
          },
        }).mount('#app')
        return Promise.resolve().then(() => {
          return document.querySelector('#container')!.innerHTML
        })
      })
      // appear
      expect(appearHtml).toBe(
        `<div class="test test-appear-from test-appear-active">a</div>` +
          `<div class="test test-appear-from test-appear-active">b</div>` +
          `<div class="test test-appear-from test-appear-active">c</div>`,
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test test-appear-active test-appear-to">a</div>` +
          `<div class="test test-appear-active test-appear-to">b</div>` +
          `<div class="test test-appear-active test-appear-to">c</div>`,
      )
      await transitionFinish()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      // enter
      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-from test-enter-active">d</div>` +
          `<div class="test test-enter-from test-enter-active">e</div>`,
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<div class="test test-enter-active test-enter-to">e</div>`,
      )
      await transitionFinish()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test">d</div>` +
          `<div class="test">e</div>`,
      )
    },
    E2E_TIMEOUT,
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
          },
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test group-enter-from group-enter-active">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-from group-leave-active group-move" style="">c</div>`,
      )
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test group-enter-active group-enter-to">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-active group-move group-leave-to" style="">c</div>`,
      )
      await transitionFinish(duration * 2)
      expect(await html('#container')).toBe(
        `<div class="test">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test" style="">a</div>`,
      )
    },
    E2E_TIMEOUT,
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
          },
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        `<div>a</div>` + `<div>b</div>` + `<div>c</div>`,
      )

      // invalid name
      expect(await htmlWhenTransitionStart()).toBe(
        `<div>b</div>` + `<div>c</div>` + `<div>a</div>`,
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
          `<div class="group-move" style="">c</div>`,
      )
      // not sure why but we just have to wait really long for this to
      // pass consistently :/
      await transitionFinish(duration * 4 + buffer)
      expect(await html('#container')).toBe(
        `<div class="" style="">a</div>` +
          `<div class="" style="">b</div>` +
          `<div class="" style="">c</div>`,
      )
    },
    E2E_TIMEOUT,
  )

  test(
    'events',
    async () => {
      const onLeaveSpy = vi.fn()
      const onEnterSpy = vi.fn()
      const onAppearSpy = vi.fn()
      const beforeLeaveSpy = vi.fn()
      const beforeEnterSpy = vi.fn()
      const beforeAppearSpy = vi.fn()
      const afterLeaveSpy = vi.fn()
      const afterEnterSpy = vi.fn()
      const afterAppearSpy = vi.fn()

      await page().exposeFunction('onLeaveSpy', onLeaveSpy)
      await page().exposeFunction('onEnterSpy', onEnterSpy)
      await page().exposeFunction('onAppearSpy', onAppearSpy)
      await page().exposeFunction('beforeLeaveSpy', beforeLeaveSpy)
      await page().exposeFunction('beforeEnterSpy', beforeEnterSpy)
      await page().exposeFunction('beforeAppearSpy', beforeAppearSpy)
      await page().exposeFunction('afterLeaveSpy', afterLeaveSpy)
      await page().exposeFunction('afterEnterSpy', afterEnterSpy)
      await page().exposeFunction('afterAppearSpy', afterAppearSpy)

      const appearHtml = await page().evaluate(() => {
        const {
          beforeAppearSpy,
          onAppearSpy,
          afterAppearSpy,
          beforeEnterSpy,
          onEnterSpy,
          afterEnterSpy,
          beforeLeaveSpy,
          onLeaveSpy,
          afterLeaveSpy,
        } = window as any
        const { createApp, ref } = (window as any).Vue
        createApp({
          template: `
                <div id="container">
                  <transition-group name="test"
                      appear
                      appear-from-class="test-appear-from"
                      appear-to-class="test-appear-to"
                      appear-active-class="test-appear-active"
                      @before-enter="beforeEnterSpy()"
                      @enter="onEnterSpy()"
                      @after-enter="afterEnterSpy()"
                      @before-leave="beforeLeaveSpy()"
                      @leave="onLeaveSpy()"
                      @after-leave="afterLeaveSpy()"
                      @before-appear="beforeAppearSpy()"
                      @appear="onAppearSpy()"
                      @after-appear="afterAppearSpy()">
                    <div v-for="item in items" :key="item" class="test">{{item}}</div>
                  </transition-group>
                </div>
                <button id="toggleBtn" @click="click">button</button>
              `,
          setup: () => {
            const items = ref(['a', 'b', 'c'])
            const click = () => (items.value = ['b', 'c', 'd'])
            return {
              click,
              items,
              beforeAppearSpy,
              onAppearSpy,
              afterAppearSpy,
              beforeEnterSpy,
              onEnterSpy,
              afterEnterSpy,
              beforeLeaveSpy,
              onLeaveSpy,
              afterLeaveSpy,
            }
          },
        }).mount('#app')
        return Promise.resolve().then(() => {
          return document.querySelector('#container')!.innerHTML
        })
      })
      expect(beforeAppearSpy).toBeCalled()
      expect(onAppearSpy).toBeCalled()
      expect(afterAppearSpy).not.toBeCalled()
      expect(appearHtml).toBe(
        `<div class="test test-appear-from test-appear-active">a</div>` +
          `<div class="test test-appear-from test-appear-active">b</div>` +
          `<div class="test test-appear-from test-appear-active">c</div>`,
      )
      await nextFrame()
      expect(afterAppearSpy).not.toBeCalled()
      expect(await html('#container')).toBe(
        `<div class="test test-appear-active test-appear-to">a</div>` +
          `<div class="test test-appear-active test-appear-to">b</div>` +
          `<div class="test test-appear-active test-appear-to">c</div>`,
      )
      await transitionFinish()
      expect(afterAppearSpy).toBeCalled()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      // enter + leave
      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test test-leave-from test-leave-active">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-from test-enter-active">d</div>`,
      )
      expect(beforeLeaveSpy).toBeCalled()
      expect(onLeaveSpy).toBeCalled()
      expect(afterLeaveSpy).not.toBeCalled()
      expect(beforeEnterSpy).toBeCalled()
      expect(onEnterSpy).toBeCalled()
      expect(afterEnterSpy).not.toBeCalled()
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>`,
      )
      expect(afterLeaveSpy).not.toBeCalled()
      expect(afterEnterSpy).not.toBeCalled()
      await transitionFinish()
      expect(await html('#container')).toBe(
        `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test">d</div>`,
      )
      expect(afterLeaveSpy).toBeCalled()
      expect(afterEnterSpy).toBeCalled()
    },
    E2E_TIMEOUT,
  )

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
      },
    }).mount(document.createElement('div'))

    expect(`<TransitionGroup> children must be keyed`).toHaveBeenWarned()
  })

  test('not warn unkeyed text children w/ whitespace preserve', () => {
    const app = createApp({
      template: `
        <transition-group name="test">
          <p key="1">1</p>
          <p key="2" v-if="false">2</p>
        </transition-group>
        `,
    })

    app.config.compilerOptions.whitespace = 'preserve'
    app.mount(document.createElement('div'))
    expect(`<TransitionGroup> children must be keyed`).not.toHaveBeenWarned()
  })

  // #5168, #7898, #9067
  test(
    'avoid set transition hooks for comment node',
    async () => {
      await page().evaluate(duration => {
        const { createApp, ref, h, createCommentVNode } = (window as any).Vue

        const show = ref(false)
        createApp({
          template: `
            <div id="container">
              <transition-group name="test">
                <div v-for="item in items" :key="item" class="test">{{item}}</div>
                <Child key="child"/>
              </transition-group>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
          components: {
            Child: {
              setup() {
                return () =>
                  show.value
                    ? h('div', { class: 'test' }, 'child')
                    : createCommentVNode('v-if', true)
              },
            },
          },
          setup: () => {
            const items = ref([])
            const click = () => {
              items.value = ['a', 'b', 'c']
              setTimeout(() => {
                show.value = true
              }, duration)
            }
            return { click, items }
          },
        }).mount('#app')
      }, duration)

      expect(await html('#container')).toBe(`<!--v-if-->`)

      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test test-enter-from test-enter-active">a</div>` +
          `<div class="test test-enter-from test-enter-active">b</div>` +
          `<div class="test test-enter-from test-enter-active">c</div>` +
          `<!--v-if-->`,
      )

      await transitionFinish(duration)
      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">child</div>`,
      )

      await transitionFinish(duration)
      expect(await html('#container')).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test">child</div>`,
      )
    },
    E2E_TIMEOUT,
  )

  // #4621, #4622, #5153
  test(
    'avoid set transition hooks for text node',
    async () => {
      await page().evaluate(() => {
        const { createApp, ref } = (window as any).Vue
        const app = createApp({
          template: `
            <div id="container">
              <transition-group name="test">
                <div class="test">foo</div>
                <div class="test" v-if="show">bar</div>
              </transition-group>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
          setup: () => {
            const show = ref(false)
            const click = () => {
              show.value = true
            }
            return { show, click }
          },
        })

        app.config.compilerOptions.whitespace = 'preserve'
        app.mount('#app')
      })

      expect(await html('#container')).toBe(`<div class="test">foo</div>` + ` `)

      expect(await htmlWhenTransitionStart()).toBe(
        `<div class="test">foo</div>` +
          ` ` +
          `<div class="test test-enter-from test-enter-active">bar</div>`,
      )

      await nextFrame()
      expect(await html('#container')).toBe(
        `<div class="test">foo</div>` +
          ` ` +
          `<div class="test test-enter-active test-enter-to">bar</div>`,
      )

      await transitionFinish(duration)
      expect(await html('#container')).toBe(
        `<div class="test">foo</div>` + ` ` + `<div class="test">bar</div>`,
      )
    },
    E2E_TIMEOUT,
  )
})
