import { E2E_TIMEOUT, setupPuppeteer } from './e2eUtils'
import path from 'node:path'
import { Transition, createApp, h, nextTick, ref } from 'vue'

describe('e2e: Transition', () => {
  const { page, html, classList, style, isVisible, timeout, nextFrame, click } =
    setupPuppeteer()
  const baseUrl = `file://${path.resolve(__dirname, './transition.html')}`

  const duration = process.env.CI ? 200 : 50
  const buffer = process.env.CI ? 50 : 20

  const transitionFinish = (time = duration) => timeout(time + buffer)

  const classWhenTransitionStart = () =>
    page().evaluate(() => {
      ;(document.querySelector('#toggleBtn') as any)!.click()
      return Promise.resolve().then(() => {
        return document.querySelector('#container div')!.className.split(/\s+/g)
      })
    })

  beforeEach(async () => {
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
  })

  describe('transition with v-if', () => {
    test(
      'basic transition',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition>
                <div v-if="toggle" class="test">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-leave-from',
          'v-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-leave-active',
          'v-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-enter-from',
          'v-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-enter-active',
          'v-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'named transition',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <div id="container">
                <transition name="test">
                  <div v-if="toggle" class="test">content</div>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'custom transition classes',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
          <div id="container">
            <transition enter-from-class="hello-from"
              enter-active-class="hello-active"
              enter-to-class="hello-to"
              leave-from-class="bye-from"
              leave-active-class="bye-active"
              leave-to-class="bye-to">
              <div v-if="toggle" class="test">content</div>
            </transition>
          </div>
          <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'bye-from',
          'bye-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'bye-active',
          'bye-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'hello-from',
          'hello-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'hello-active',
          'hello-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition with dynamic name',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
          <div id="container">
            <transition :name="name">
              <div v-if="toggle" class="test">content</div>
            </transition>
          </div>
          <button id="toggleBtn" @click="click">button</button>
          <button id="changeNameBtn" @click="changeName">button</button>
          `,
            setup: () => {
              const name = ref('test')
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              const changeName = () => (name.value = 'changed')
              return { toggle, click, name, changeName }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        await page().evaluate(() => {
          ;(document.querySelector('#changeNameBtn') as any).click()
        })
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'changed-enter-from',
          'changed-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'changed-enter-active',
          'changed-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition events without appear',
      async () => {
        const beforeLeaveSpy = vi.fn()
        const onLeaveSpy = vi.fn()
        const afterLeaveSpy = vi.fn()
        const beforeEnterSpy = vi.fn()
        const onEnterSpy = vi.fn()
        const afterEnterSpy = vi.fn()

        await page().exposeFunction('onLeaveSpy', onLeaveSpy)
        await page().exposeFunction('onEnterSpy', onEnterSpy)
        await page().exposeFunction('beforeLeaveSpy', beforeLeaveSpy)
        await page().exposeFunction('beforeEnterSpy', beforeEnterSpy)
        await page().exposeFunction('afterLeaveSpy', afterLeaveSpy)
        await page().exposeFunction('afterEnterSpy', afterEnterSpy)

        await page().evaluate(() => {
          const {
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
              <transition
                name="test"
                @before-enter="beforeEnterSpy()"
                @enter="onEnterSpy()"
                @after-enter="afterEnterSpy()"
                @before-leave="beforeLeaveSpy()"
                @leave="onLeaveSpy()"
                @after-leave="afterLeaveSpy()">
                <div v-if="toggle" class="test">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return {
                toggle,
                click,
                beforeEnterSpy,
                onEnterSpy,
                afterEnterSpy,
                beforeLeaveSpy,
                onLeaveSpy,
                afterLeaveSpy,
              }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        expect(beforeLeaveSpy).toBeCalled()
        expect(onLeaveSpy).toBeCalled()
        expect(afterLeaveSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        expect(afterLeaveSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')
        expect(afterLeaveSpy).toBeCalled()

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        expect(beforeEnterSpy).toBeCalled()
        expect(onEnterSpy).toBeCalled()
        expect(afterEnterSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        expect(afterEnterSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
        expect(afterEnterSpy).toBeCalled()
      },
      E2E_TIMEOUT,
    )

    test(
      'events with arguments',
      async () => {
        const beforeLeaveSpy = vi.fn()
        const onLeaveSpy = vi.fn()
        const afterLeaveSpy = vi.fn()
        const beforeEnterSpy = vi.fn()
        const onEnterSpy = vi.fn()
        const afterEnterSpy = vi.fn()

        await page().exposeFunction('onLeaveSpy', onLeaveSpy)
        await page().exposeFunction('onEnterSpy', onEnterSpy)
        await page().exposeFunction('beforeLeaveSpy', beforeLeaveSpy)
        await page().exposeFunction('beforeEnterSpy', beforeEnterSpy)
        await page().exposeFunction('afterLeaveSpy', afterLeaveSpy)
        await page().exposeFunction('afterEnterSpy', afterEnterSpy)

        await page().evaluate(() => {
          const {
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
              <transition
                :css="false"
                name="test"
                @before-enter="beforeEnterSpy"
                @enter="onEnterSpy"
                @after-enter="afterEnterSpy"
                @before-leave="beforeLeaveSpy"
                @leave="onLeaveSpy"
                @after-leave="afterLeaveSpy">
                <div v-if="toggle" class="test">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return {
                toggle,
                click,
                beforeEnterSpy(el: Element) {
                  beforeEnterSpy()
                  el.classList.add('before-enter')
                },
                onEnterSpy(el: Element, done: () => void) {
                  onEnterSpy()
                  el.classList.add('enter')
                  setTimeout(done, 200)
                },
                afterEnterSpy(el: Element) {
                  afterEnterSpy()
                  el.classList.add('after-enter')
                },
                beforeLeaveSpy(el: HTMLDivElement) {
                  beforeLeaveSpy()
                  el.classList.add('before-leave')
                },
                onLeaveSpy(el: HTMLDivElement, done: () => void) {
                  onLeaveSpy()
                  el.classList.add('leave')
                  setTimeout(done, 200)
                },
                afterLeaveSpy: (el: Element) => {
                  afterLeaveSpy()
                },
              }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        await click('#toggleBtn')
        expect(beforeLeaveSpy).toBeCalled()
        expect(onLeaveSpy).toBeCalled()
        expect(afterLeaveSpy).not.toBeCalled()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'before-leave',
          'leave',
        ])

        await timeout(200 + buffer)
        expect(afterLeaveSpy).toBeCalled()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        await click('#toggleBtn')
        expect(beforeEnterSpy).toBeCalled()
        expect(onEnterSpy).toBeCalled()
        expect(afterEnterSpy).not.toBeCalled()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'before-enter',
          'enter',
        ])

        await timeout(200 + buffer)
        expect(afterEnterSpy).toBeCalled()
        expect(await html('#container')).toBe(
          '<div class="test before-enter enter after-enter">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test('onEnterCancelled', async () => {
      const enterCancelledSpy = vi.fn()

      await page().exposeFunction('enterCancelledSpy', enterCancelledSpy)

      await page().evaluate(() => {
        const { enterCancelledSpy } = window as any
        const { createApp, ref } = (window as any).Vue
        createApp({
          template: `
            <div id="container">
              <transition
                name="test"
                @enter-cancelled="enterCancelledSpy()">
                <div v-if="toggle" class="test">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
          setup: () => {
            const toggle = ref(false)
            const click = () => (toggle.value = !toggle.value)
            return {
              toggle,
              click,
              enterCancelledSpy,
            }
          },
        }).mount('#app')
      })
      expect(await html('#container')).toBe('<!--v-if-->')

      // enter
      expect(await classWhenTransitionStart()).toStrictEqual([
        'test',
        'test-enter-from',
        'test-enter-active',
      ])
      await nextFrame()
      expect(await classList('.test')).toStrictEqual([
        'test',
        'test-enter-active',
        'test-enter-to',
      ])

      // cancel (leave)
      expect(await classWhenTransitionStart()).toStrictEqual([
        'test',
        'test-leave-from',
        'test-leave-active',
      ])
      expect(enterCancelledSpy).toBeCalled()
      await nextFrame()
      expect(await classList('.test')).toStrictEqual([
        'test',
        'test-leave-active',
        'test-leave-to',
      ])
      await transitionFinish()
      expect(await html('#container')).toBe('<!--v-if-->')
    })

    test(
      'transition on appear',
      async () => {
        const appearClass = await page().evaluate(async () => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <div id="container">
                <transition name="test"
                            appear
                            appear-from-class="test-appear-from"
                            appear-to-class="test-appear-to"
                            appear-active-class="test-appear-active">
                  <div v-if="toggle" class="test">content</div>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
          return Promise.resolve().then(() => {
            return document.querySelector('.test')!.className.split(/\s+/g)
          })
        })
        // appear
        expect(appearClass).toStrictEqual([
          'test',
          'test-appear-from',
          'test-appear-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-appear-active',
          'test-appear-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition events with appear',
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

        const appearClass = await page().evaluate(async () => {
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
                <transition
                  name="test"
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
                  <div v-if="toggle" class="test">content</div>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return {
                toggle,
                click,
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
            return document.querySelector('.test')!.className.split(/\s+/g)
          })
        })
        // appear
        expect(appearClass).toStrictEqual([
          'test',
          'test-appear-from',
          'test-appear-active',
        ])
        expect(beforeAppearSpy).toBeCalled()
        expect(onAppearSpy).toBeCalled()
        expect(afterAppearSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-appear-active',
          'test-appear-to',
        ])
        expect(afterAppearSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
        expect(afterAppearSpy).toBeCalled()

        expect(beforeEnterSpy).not.toBeCalled()
        expect(onEnterSpy).not.toBeCalled()
        expect(afterEnterSpy).not.toBeCalled()

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        expect(beforeLeaveSpy).toBeCalled()
        expect(onLeaveSpy).toBeCalled()
        expect(afterLeaveSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        expect(afterLeaveSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')
        expect(afterLeaveSpy).toBeCalled()

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        expect(beforeEnterSpy).toBeCalled()
        expect(onEnterSpy).toBeCalled()
        expect(afterEnterSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        expect(afterEnterSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
        expect(afterEnterSpy).toBeCalled()
      },
      E2E_TIMEOUT,
    )

    test(
      'css: false',
      async () => {
        const onBeforeEnterSpy = vi.fn()
        const onEnterSpy = vi.fn()
        const onAfterEnterSpy = vi.fn()
        const onBeforeLeaveSpy = vi.fn()
        const onLeaveSpy = vi.fn()
        const onAfterLeaveSpy = vi.fn()

        await page().exposeFunction('onBeforeEnterSpy', onBeforeEnterSpy)
        await page().exposeFunction('onEnterSpy', onEnterSpy)
        await page().exposeFunction('onAfterEnterSpy', onAfterEnterSpy)
        await page().exposeFunction('onBeforeLeaveSpy', onBeforeLeaveSpy)
        await page().exposeFunction('onLeaveSpy', onLeaveSpy)
        await page().exposeFunction('onAfterLeaveSpy', onAfterLeaveSpy)

        await page().evaluate(() => {
          const {
            onBeforeEnterSpy,
            onEnterSpy,
            onAfterEnterSpy,
            onBeforeLeaveSpy,
            onLeaveSpy,
            onAfterLeaveSpy,
          } = window as any
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition
                :css="false"
                name="test"
                @before-enter="onBeforeEnterSpy()"
                @enter="onEnterSpy()"
                @after-enter="onAfterEnterSpy()"
                @before-leave="onBeforeLeaveSpy()"
                @leave="onLeaveSpy()"
                @after-leave="onAfterLeaveSpy()">
                <div v-if="toggle" class="test">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click"></button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return {
                toggle,
                click,
                onBeforeEnterSpy,
                onEnterSpy,
                onAfterEnterSpy,
                onBeforeLeaveSpy,
                onLeaveSpy,
                onAfterLeaveSpy,
              }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        await click('#toggleBtn')
        expect(onBeforeLeaveSpy).toBeCalled()
        expect(onLeaveSpy).toBeCalled()
        expect(onAfterLeaveSpy).toBeCalled()
        expect(await html('#container')).toBe('<!--v-if-->')
        // enter
        await classWhenTransitionStart()
        expect(onBeforeEnterSpy).toBeCalled()
        expect(onEnterSpy).toBeCalled()
        expect(onAfterEnterSpy).toBeCalled()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'no transition detected',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition name="noop">
                <div v-if="toggle">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div>content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'noop-leave-from',
          'noop-leave-active',
        ])
        await nextFrame()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'noop-enter-from',
          'noop-enter-active',
        ])
        await nextFrame()
        expect(await html('#container')).toBe('<div class="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'animations',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <div id="container">
                <transition name="test-anim">
                  <div v-if="toggle">content</div>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div>content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test-anim-leave-from',
          'test-anim-leave-active',
        ])
        await nextFrame()
        expect(await classList('#container div')).toStrictEqual([
          'test-anim-leave-active',
          'test-anim-leave-to',
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test-anim-enter-from',
          'test-anim-enter-active',
        ])
        await nextFrame()
        expect(await classList('#container div')).toStrictEqual([
          'test-anim-enter-active',
          'test-anim-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'explicit transition type',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <div id="container"><transition name="test-anim-long" type="animation"><div v-if="toggle">content</div></transition></div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div>content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test-anim-long-leave-from',
          'test-anim-long-leave-active',
        ])
        await nextFrame()
        expect(await classList('#container div')).toStrictEqual([
          'test-anim-long-leave-active',
          'test-anim-long-leave-to',
        ])

        if (!process.env.CI) {
          await new Promise(r => {
            setTimeout(r, duration - buffer)
          })
          expect(await classList('#container div')).toStrictEqual([
            'test-anim-long-leave-active',
            'test-anim-long-leave-to',
          ])
        }

        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test-anim-long-enter-from',
          'test-anim-long-enter-active',
        ])
        await nextFrame()
        expect(await classList('#container div')).toStrictEqual([
          'test-anim-long-enter-active',
          'test-anim-long-enter-to',
        ])

        if (!process.env.CI) {
          await new Promise(r => {
            setTimeout(r, duration - buffer)
          })
          expect(await classList('#container div')).toStrictEqual([
            'test-anim-long-enter-active',
            'test-anim-long-enter-to',
          ])
        }

        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<div class="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition on SVG elements',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <svg id="container">
                <transition name="test">
                  <circle v-if="toggle" cx="0" cy="0" r="10" class="test"></circle>
                </transition>
              </svg>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe(
          '<circle cx="0" cy="0" r="10" class="test"></circle>',
        )

        const svgTransitionStart = () =>
          page().evaluate(() => {
            document.querySelector('button')!.click()
            return Promise.resolve().then(() => {
              return document
                .querySelector('.test')!
                .getAttribute('class')!
                .split(/\s+/g)
            })
          })

        // leave
        expect(await svgTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await svgTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<circle cx="0" cy="0" r="10" class="test"></circle>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'custom transition higher-order component',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref, h, Transition } = (window as any).Vue
          createApp({
            template: `
              <div id="container"><my-transition><div v-if="toggle" class="test">content</div></my-transition></div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            components: {
              'my-transition': (props: any, { slots }: any) => {
                return h(Transition, { name: 'test' }, slots)
              },
            },
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition on child components with empty root node',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <div id="container">
                <transition name="test">
                  <component class="test" :is="view"></component>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
              <button id="changeViewBtn" @click="change">button</button>
            `,
            components: {
              one: {
                template: '<div v-if="false">one</div>',
              },
              two: {
                template: '<div>two</div>',
              },
            },
            setup: () => {
              const toggle = ref(true)
              const view = ref('one')
              const click = () => (toggle.value = !toggle.value)
              const change = () =>
                (view.value = view.value === 'one' ? 'two' : 'one')
              return { toggle, click, change, view }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<!--v-if-->')

        // change view -> 'two'
        await page().evaluate(() => {
          ;(document.querySelector('#changeViewBtn') as any)!.click()
        })
        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">two</div>')

        // change view -> 'one'
        await page().evaluate(() => {
          ;(document.querySelector('#changeViewBtn') as any)!.click()
        })
        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')
      },
      E2E_TIMEOUT,
    )

    // issue https://github.com/vuejs/core/issues/7649
    test(
      'transition with v-if at component root-level',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <div id="container">
                <transition name="test" mode="out-in">
                  <component class="test" :is="view"></component>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
              <button id="changeViewBtn" @click="change">button</button>
            `,
            components: {
              one: {
                template: '<div v-if="false">one</div>',
              },
              two: {
                template: '<div>two</div>',
              },
            },
            setup: () => {
              const toggle = ref(true)
              const view = ref('one')
              const click = () => (toggle.value = !toggle.value)
              const change = () =>
                (view.value = view.value === 'one' ? 'two' : 'one')
              return { toggle, click, change, view }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<!--v-if-->')

        // change view -> 'two'
        await page().evaluate(() => {
          ;(document.querySelector('#changeViewBtn') as any)!.click()
        })
        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">two</div>')

        // change view -> 'one'
        await page().evaluate(() => {
          ;(document.querySelector('#changeViewBtn') as any)!.click()
        })
        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')
      },
      E2E_TIMEOUT,
    )

    // #3716
    test(
      'wrapping transition + fallthrough attrs',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            components: {
              'my-transition': {
                template: `
                  <transition foo="1" name="test">
                    <slot></slot>
                  </transition>
                `,
              },
            },
            template: `
            <div id="container">
              <my-transition>
                <div v-if="toggle">content</div>
              </my-transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div foo="1">content</div>')

        await click('#toggleBtn')
        // toggle again before leave finishes
        await nextTick()
        await click('#toggleBtn')

        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div foo="1" class="">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    // #11061
    test(
      'transition + fallthrough attrs (in-out mode)',
      async () => {
        const beforeLeaveSpy = vi.fn()
        const onLeaveSpy = vi.fn()
        const afterLeaveSpy = vi.fn()
        const beforeEnterSpy = vi.fn()
        const onEnterSpy = vi.fn()
        const afterEnterSpy = vi.fn()

        await page().exposeFunction('onLeaveSpy', onLeaveSpy)
        await page().exposeFunction('onEnterSpy', onEnterSpy)
        await page().exposeFunction('beforeLeaveSpy', beforeLeaveSpy)
        await page().exposeFunction('beforeEnterSpy', beforeEnterSpy)
        await page().exposeFunction('afterLeaveSpy', afterLeaveSpy)
        await page().exposeFunction('afterEnterSpy', afterEnterSpy)

        await page().evaluate(() => {
          const { onEnterSpy, onLeaveSpy } = window as any
          const { createApp, ref } = (window as any).Vue
          createApp({
            components: {
              one: {
                template: '<div>one</div>',
              },
              two: {
                template: '<div>two</div>',
              },
            },
            template: `
            <div id="container">
              <transition foo="1" name="test" mode="in-out" 
                @before-enter="beforeEnterSpy()"
                @enter="onEnterSpy()"
                @after-enter="afterEnterSpy()"
                @before-leave="beforeLeaveSpy()"
                @leave="onLeaveSpy()"
                @after-leave="afterLeaveSpy()">
                <component :is="view"></component>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const view = ref('one')
              const click = () =>
                (view.value = view.value === 'one' ? 'two' : 'one')
              return {
                view,
                click,
                beforeEnterSpy,
                onEnterSpy,
                afterEnterSpy,
                beforeLeaveSpy,
                onLeaveSpy,
                afterLeaveSpy,
              }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div foo="1">one</div>')

        // toggle
        await click('#toggleBtn')
        await nextTick()
        await transitionFinish()
        expect(beforeEnterSpy).toBeCalledTimes(1)
        expect(onEnterSpy).toBeCalledTimes(1)
        expect(afterEnterSpy).toBeCalledTimes(1)
        expect(beforeLeaveSpy).toBeCalledTimes(1)
        expect(onLeaveSpy).toBeCalledTimes(1)
        expect(afterLeaveSpy).toBeCalledTimes(1)

        expect(await html('#container')).toBe('<div foo="1" class="">two</div>')

        // toggle back
        await click('#toggleBtn')
        await nextTick()
        await transitionFinish()
        expect(beforeEnterSpy).toBeCalledTimes(2)
        expect(onEnterSpy).toBeCalledTimes(2)
        expect(afterEnterSpy).toBeCalledTimes(2)
        expect(beforeLeaveSpy).toBeCalledTimes(2)
        expect(onLeaveSpy).toBeCalledTimes(2)
        expect(afterLeaveSpy).toBeCalledTimes(2)

        expect(await html('#container')).toBe('<div foo="1" class="">one</div>')
      },
      E2E_TIMEOUT,
    )
  })

  describe('transition with KeepAlive', () => {
    test(
      'unmount innerChild (out-in mode)',
      async () => {
        const unmountSpy = vi.fn()
        await page().exposeFunction('unmountSpy', unmountSpy)
        await page().evaluate(() => {
          const { unmountSpy } = window as any
          const { createApp, ref, h, onUnmounted } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition mode="out-in">
                <KeepAlive :include="includeRef">
                  <TrueBranch v-if="toggle"></TrueBranch>
                </KeepAlive>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            components: {
              TrueBranch: {
                name: 'TrueBranch',
                setup() {
                  onUnmounted(unmountSpy)
                  const count = ref(0)
                  return () => h('div', count.value)
                },
              },
            },
            setup: () => {
              const includeRef = ref(['TrueBranch'])
              const toggle = ref(true)
              const click = () => {
                toggle.value = !toggle.value
                if (toggle.value) {
                  includeRef.value = ['TrueBranch']
                } else {
                  includeRef.value = []
                }
              }
              return { toggle, click, unmountSpy, includeRef }
            },
          }).mount('#app')
        })

        await transitionFinish()
        expect(await html('#container')).toBe('<div>0</div>')

        await click('#toggleBtn')

        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')
        expect(unmountSpy).toBeCalledTimes(1)
      },
      E2E_TIMEOUT,
    )

    // #11775
    test(
      'switch child then update include (out-in mode)',
      async () => {
        const onUpdatedSpyA = vi.fn()
        const onUnmountedSpyC = vi.fn()

        await page().exposeFunction('onUpdatedSpyA', onUpdatedSpyA)
        await page().exposeFunction('onUnmountedSpyC', onUnmountedSpyC)

        await page().evaluate(() => {
          const { onUpdatedSpyA, onUnmountedSpyC } = window as any
          const { createApp, ref, shallowRef, h, onUpdated, onUnmounted } = (
            window as any
          ).Vue
          createApp({
            template: `
            <div id="container">
              <transition mode="out-in">
                <KeepAlive :include="includeRef">
                  <component :is="current" />
                </KeepAlive>
              </transition>
            </div>
            <button id="switchToB" @click="switchToB">switchToB</button>
            <button id="switchToC" @click="switchToC">switchToC</button>
            <button id="switchToA" @click="switchToA">switchToA</button>
          `,
            components: {
              CompA: {
                name: 'CompA',
                setup() {
                  onUpdated(onUpdatedSpyA)
                  return () => h('div', 'CompA')
                },
              },
              CompB: {
                name: 'CompB',
                setup() {
                  return () => h('div', 'CompB')
                },
              },
              CompC: {
                name: 'CompC',
                setup() {
                  onUnmounted(onUnmountedSpyC)
                  return () => h('div', 'CompC')
                },
              },
            },
            setup: () => {
              const includeRef = ref(['CompA', 'CompB', 'CompC'])
              const current = shallowRef('CompA')
              const switchToB = () => (current.value = 'CompB')
              const switchToC = () => (current.value = 'CompC')
              const switchToA = () => {
                current.value = 'CompA'
                includeRef.value = ['CompA']
              }
              return { current, switchToB, switchToC, switchToA, includeRef }
            },
          }).mount('#app')
        })

        await transitionFinish()
        expect(await html('#container')).toBe('<div>CompA</div>')

        await click('#switchToB')
        await nextTick()
        await click('#switchToC')
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="">CompC</div>')

        await click('#switchToA')
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="">CompA</div>')

        // expect CompA only update once
        expect(onUpdatedSpyA).toBeCalledTimes(1)
        expect(onUnmountedSpyC).toBeCalledTimes(1)
      },
      E2E_TIMEOUT,
    )

    // #10827
    test(
      'switch and update child then update include (out-in mode)',
      async () => {
        const onUnmountedSpyB = vi.fn()
        await page().exposeFunction('onUnmountedSpyB', onUnmountedSpyB)

        await page().evaluate(() => {
          const { onUnmountedSpyB } = window as any
          const {
            createApp,
            ref,
            shallowRef,
            h,
            provide,
            inject,
            onUnmounted,
          } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition name="test-anim" mode="out-in">
                <KeepAlive :include="includeRef">
                  <component :is="current" />
                </KeepAlive>
              </transition>
            </div>
            <button id="switchToA" @click="switchToA">switchToA</button>
            <button id="switchToB" @click="switchToB">switchToB</button>
          `,
            components: {
              CompA: {
                name: 'CompA',
                setup() {
                  const current = inject('current')
                  return () => h('div', current.value)
                },
              },
              CompB: {
                name: 'CompB',
                setup() {
                  const current = inject('current')
                  onUnmounted(onUnmountedSpyB)
                  return () => h('div', current.value)
                },
              },
            },
            setup: () => {
              const includeRef = ref(['CompA'])
              const current = shallowRef('CompA')
              provide('current', current)

              const switchToB = () => {
                current.value = 'CompB'
                includeRef.value = ['CompA', 'CompB']
              }
              const switchToA = () => {
                current.value = 'CompA'
                includeRef.value = ['CompA']
              }
              return { current, switchToB, switchToA, includeRef }
            },
          }).mount('#app')
        })

        await transitionFinish()
        expect(await html('#container')).toBe('<div>CompA</div>')

        await click('#switchToB')
        await transitionFinish()
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="">CompB</div>')

        await click('#switchToA')
        await transitionFinish()
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="">CompA</div>')

        expect(onUnmountedSpyB).toBeCalledTimes(1)
      },
      E2E_TIMEOUT,
    )
  })

  describe('transition with Suspense', () => {
    // #1583
    test(
      'async component transition inside Suspense',
      async () => {
        const onLeaveSpy = vi.fn()
        const onEnterSpy = vi.fn()

        await page().exposeFunction('onLeaveSpy', onLeaveSpy)
        await page().exposeFunction('onEnterSpy', onEnterSpy)

        await page().evaluate(() => {
          const { onEnterSpy, onLeaveSpy } = window as any
          const { createApp, ref, h } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition @enter="onEnterSpy()" @leave="onLeaveSpy()">
                <Suspense>
                  <Comp v-if="toggle" class="test">content</Comp>
                </Suspense>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            components: {
              Comp: {
                async setup() {
                  return () => h('div', { class: 'test' }, 'content')
                },
              },
            },
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click, onEnterSpy, onLeaveSpy }
            },
          }).mount('#app')
        })

        expect(onEnterSpy).toBeCalledTimes(1)
        await nextFrame()
        expect(await html('#container')).toBe(
          '<div class="test v-enter-active v-enter-to">content</div>',
        )
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-leave-from',
          'v-leave-active',
        ])
        expect(onLeaveSpy).toBeCalledTimes(1)
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-leave-active',
          'v-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        const enterClass = await page().evaluate(async () => {
          ;(document.querySelector('#toggleBtn') as any)!.click()
          // nextTrick for patch start
          await Promise.resolve()
          // nextTrick for Suspense resolve
          await Promise.resolve()
          // nextTrick for dom transition start
          await Promise.resolve()
          return document
            .querySelector('#container div')!
            .className.split(/\s+/g)
        })
        expect(enterClass).toStrictEqual([
          'test',
          'v-enter-from',
          'v-enter-active',
        ])
        expect(onEnterSpy).toBeCalledTimes(2)
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-enter-active',
          'v-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    // #1689
    test(
      'static node transition inside Suspense',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition>
                <Suspense>
                  <div v-if="toggle" class="test">content</div>
                </Suspense>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-leave-from',
          'v-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-leave-active',
          'v-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-enter-from',
          'v-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-enter-active',
          'v-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'out-in mode with Suspense',
      async () => {
        const onLeaveSpy = vi.fn()
        const onEnterSpy = vi.fn()

        await page().exposeFunction('onLeaveSpy', onLeaveSpy)
        await page().exposeFunction('onEnterSpy', onEnterSpy)

        await page().evaluate(() => {
          const { createApp, shallowRef, h } = (window as any).Vue
          const One = {
            async setup() {
              return () => h('div', { class: 'test' }, 'one')
            },
          }
          const Two = {
            async setup() {
              return () => h('div', { class: 'test' }, 'two')
            },
          }
          createApp({
            template: `
              <div id="container">
                <transition mode="out-in">
                  <Suspense>
                    <component :is="view"/>
                  </Suspense>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const view = shallowRef(One)
              const click = () => {
                view.value = view.value === One ? Two : One
              }
              return { view, click }
            },
          }).mount('#app')
        })

        await nextFrame()
        expect(await html('#container')).toBe(
          '<div class="test v-enter-active v-enter-to">one</div>',
        )
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">one</div>')

        // leave
        await classWhenTransitionStart()
        await nextFrame()
        expect(await html('#container')).toBe(
          '<div class="test v-leave-active v-leave-to">one</div>',
        )
        await transitionFinish()
        await nextFrame()
        // expect(await html('#container')).toBe(
        //   '<div class="test v-enter-active v-enter-to">two</div>'
        // )
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">two</div>')
      },
      E2E_TIMEOUT,
    )

    // #3963
    test(
      'Suspense fallback should work with transition',
      async () => {
        await page().evaluate(() => {
          const { createApp, shallowRef, h } = (window as any).Vue

          const One = {
            template: `<div>{{ msg }}</div>`,
            setup() {
              return new Promise(_resolve => {
                // @ts-expect-error
                window.resolve = () =>
                  _resolve({
                    msg: 'success',
                  })
              })
            },
          }

          createApp({
            template: `
              <div id="container">
                <transition mode="out-in">
                  <Suspense :timeout="0">
                    <template #default>
                      <component :is="view" />
                    </template>
                    <template #fallback>
                      <div>Loading...</div>
                    </template>
                  </Suspense>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const view = shallowRef(null)
              const click = () => {
                view.value = view.value ? null : h(One)
              }
              return { view, click }
            },
          }).mount('#app')
        })

        expect(await html('#container')).toBe('<!---->')

        await click('#toggleBtn')
        await nextFrame()
        expect(await html('#container')).toBe('<div class="">Loading...</div>')

        await page().evaluate(() => {
          // @ts-expect-error
          window.resolve()
        })

        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<div class="">success</div>')
      },
      E2E_TIMEOUT,
    )

    // #5844
    test('children mount should be called after html changes', async () => {
      const fooMountSpy = vi.fn()
      const barMountSpy = vi.fn()

      await page().exposeFunction('fooMountSpy', fooMountSpy)
      await page().exposeFunction('barMountSpy', barMountSpy)

      await page().evaluate(() => {
        const { fooMountSpy, barMountSpy } = window as any
        const { createApp, ref, h, onMounted } = (window as any).Vue
        createApp({
          template: `
          <div id="container">
            <transition mode="out-in">
              <Suspense>
                <Foo v-if="toggle" />
                <Bar v-else />
              </Suspense>
            </transition>
          </div>
          <button id="toggleBtn" @click="click">button</button>
        `,
          components: {
            Foo: {
              setup() {
                const el = ref(null)
                onMounted(() => {
                  fooMountSpy(
                    !!el.value,
                    !!document.getElementById('foo'),
                    !!document.getElementById('bar'),
                  )
                })

                return () => h('div', { ref: el, id: 'foo' }, 'Foo')
              },
            },
            Bar: {
              setup() {
                const el = ref(null)
                onMounted(() => {
                  barMountSpy(
                    !!el.value,
                    !!document.getElementById('foo'),
                    !!document.getElementById('bar'),
                  )
                })

                return () => h('div', { ref: el, id: 'bar' }, 'Bar')
              },
            },
          },
          setup: () => {
            const toggle = ref(true)
            const click = () => (toggle.value = !toggle.value)
            return { toggle, click }
          },
        }).mount('#app')
      })

      await nextFrame()
      expect(await html('#container')).toBe('<div id="foo">Foo</div>')
      await transitionFinish()

      expect(fooMountSpy).toBeCalledTimes(1)
      expect(fooMountSpy).toHaveBeenNthCalledWith(1, true, true, false)

      await page().evaluate(async () => {
        ;(document.querySelector('#toggleBtn') as any)!.click()
        // nextTrick for patch start
        await Promise.resolve()
        // nextTrick for Suspense resolve
        await Promise.resolve()
        // nextTrick for dom transition start
        await Promise.resolve()
        return document.querySelector('#container div')!.className.split(/\s+/g)
      })

      await nextFrame()
      await transitionFinish()

      expect(await html('#container')).toBe('<div id="bar" class="">Bar</div>')

      expect(barMountSpy).toBeCalledTimes(1)
      expect(barMountSpy).toHaveBeenNthCalledWith(1, true, false, true)
    })

    // #8105
    test(
      'trigger again when transition is not finished',
      async () => {
        await page().evaluate(duration => {
          const { createApp, shallowRef, h } = (window as any).Vue
          const One = {
            async setup() {
              return () => h('div', { class: 'test' }, 'one')
            },
          }
          const Two = {
            async setup() {
              return () => h('div', { class: 'test' }, 'two')
            },
          }
          createApp({
            template: `
            <div id="container">
              <transition name="test" mode="out-in" duration="${duration}">
                <Suspense>
                  <component :is="view"/>
                </Suspense>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const view = shallowRef(One)
              const click = () => {
                view.value = view.value === One ? Two : One
              }
              return { view, click }
            },
          }).mount('#app')
        }, duration)

        await nextFrame()
        expect(await html('#container')).toBe(
          '<div class="test test-enter-active test-enter-to">one</div>',
        )

        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">one</div>')

        // trigger twice
        classWhenTransitionStart()
        classWhenTransitionStart()
        await nextFrame()
        expect(await html('#container')).toBe(
          '<div class="test test-leave-active test-leave-to">one</div>',
        )

        await transitionFinish()
        await nextFrame()
        expect(await html('#container')).toBe(
          '<div class="test test-enter-active test-enter-to">one</div>',
        )

        await transitionFinish()
        await nextFrame()
        expect(await html('#container')).toBe('<div class="test">one</div>')
      },
      E2E_TIMEOUT,
    )

    // #9996
    test(
      'trigger again when transition is not finished & correctly anchor',
      async () => {
        await page().evaluate(duration => {
          const { createApp, shallowRef, h } = (window as any).Vue
          const One = {
            async setup() {
              return () => h('div', { class: 'test' }, 'one')
            },
          }
          const Two = {
            async setup() {
              return () => h('div', { class: 'test' }, 'two')
            },
          }
          createApp({
            template: `
            <div id="container">
              <div>Top</div>
              <transition name="test" mode="out-in" :duration="${duration}">
                <Suspense>
                  <component :is="view"/>
                </Suspense>
              </transition>
              <div>Bottom</div>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const view = shallowRef(One)
              const click = () => {
                view.value = view.value === One ? Two : One
              }
              return { view, click }
            },
          }).mount('#app')
        }, duration)

        await nextFrame()
        expect(await html('#container')).toBe(
          '<div>Top</div><div class="test test-enter-active test-enter-to">one</div><div>Bottom</div>',
        )

        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div>Top</div><div class="test">one</div><div>Bottom</div>',
        )

        // trigger twice
        classWhenTransitionStart()
        await nextFrame()
        expect(await html('#container')).toBe(
          '<div>Top</div><div class="test test-leave-active test-leave-to">one</div><div>Bottom</div>',
        )

        await transitionFinish()
        await nextFrame()
        expect(await html('#container')).toBe(
          '<div>Top</div><div class="test test-enter-active test-enter-to">two</div><div>Bottom</div>',
        )

        await transitionFinish()
        await nextFrame()
        expect(await html('#container')).toBe(
          '<div>Top</div><div class="test">two</div><div>Bottom</div>',
        )
      },
      E2E_TIMEOUT,
    )

    // #11806
    test(
      'switch between Async and Sync child when transition is not finished',
      async () => {
        await page().evaluate(() => {
          const { createApp, shallowRef, h, nextTick } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <Transition mode="out-in">
                <Suspense>
                  <component :is="view"/>
                </Suspense>
              </Transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const view = shallowRef('SyncB')
              const click = async () => {
                view.value = 'SyncA'
                await nextTick()
                view.value = 'AsyncB'
                await nextTick()
                view.value = 'SyncB'
              }
              return { view, click }
            },
            components: {
              SyncA: {
                setup() {
                  return () => h('div', 'SyncA')
                },
              },
              AsyncB: {
                async setup() {
                  await nextTick()
                  return () => h('div', 'AsyncB')
                },
              },
              SyncB: {
                setup() {
                  return () => h('div', 'SyncB')
                },
              },
            },
          }).mount('#app')
        })

        expect(await html('#container')).toBe('<div>SyncB</div>')

        await click('#toggleBtn')
        await nextFrame()
        await transitionFinish()
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="">SyncB</div>')
      },
      E2E_TIMEOUT,
    )
  })

  describe('transition with Teleport', () => {
    test(
      'apply transition to teleport child',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref, h } = (window as any).Vue
          createApp({
            template: `
            <div id="target"></div>
            <div id="container">
              <transition>
                <Teleport to="#target">
                  <!-- comment -->
                  <Comp v-if="toggle" class="test">content</Comp>
                </Teleport>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            components: {
              Comp: {
                setup() {
                  return () => h('div', { class: 'test' }, 'content')
                },
              },
            },
            setup: () => {
              const toggle = ref(false)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })

        expect(await html('#target')).toBe('<!-- comment --><!--v-if-->')
        expect(await html('#container')).toBe(
          '<!--teleport start--><!--teleport end-->',
        )

        const classWhenTransitionStart = () =>
          page().evaluate(() => {
            ;(document.querySelector('#toggleBtn') as any)!.click()
            return Promise.resolve().then(() => {
              // find the class of teleported node
              return document
                .querySelector('#target div')!
                .className.split(/\s+/g)
            })
          })

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-enter-from',
          'v-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-enter-active',
          'v-enter-to',
        ])
        await transitionFinish()
        expect(await html('#target')).toBe(
          '<!-- comment --><div class="test">content</div>',
        )

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-leave-from',
          'v-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-leave-active',
          'v-leave-to',
        ])
        await transitionFinish()
        expect(await html('#target')).toBe('<!-- comment --><!--v-if-->')
        expect(await html('#container')).toBe(
          '<!--teleport start--><!--teleport end-->',
        )
      },
      E2E_TIMEOUT,
    )
  })

  describe('transition with v-show', () => {
    test(
      'named transition with v-show',
      async () => {
        await page().evaluate(() => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition name="test">
                <div v-show="toggle" class="test">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')
        expect(await isVisible('.test')).toBe(true)

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish()
        expect(await isVisible('.test')).toBe(false)

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div class="test" style="">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'transition events with v-show',
      async () => {
        const beforeLeaveSpy = vi.fn()
        const onLeaveSpy = vi.fn()
        const afterLeaveSpy = vi.fn()
        const beforeEnterSpy = vi.fn()
        const onEnterSpy = vi.fn()
        const afterEnterSpy = vi.fn()

        await page().exposeFunction('onLeaveSpy', onLeaveSpy)
        await page().exposeFunction('onEnterSpy', onEnterSpy)
        await page().exposeFunction('beforeLeaveSpy', beforeLeaveSpy)
        await page().exposeFunction('beforeEnterSpy', beforeEnterSpy)
        await page().exposeFunction('afterLeaveSpy', afterLeaveSpy)
        await page().exposeFunction('afterEnterSpy', afterEnterSpy)

        await page().evaluate(() => {
          const {
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
              <transition
                name="test"
                @before-enter="beforeEnterSpy()"
                @enter="onEnterSpy()"
                @after-enter="afterEnterSpy()"
                @before-leave="beforeLeaveSpy()"
                @leave="onLeaveSpy()"
                @after-leave="afterLeaveSpy()">
                <div v-show="toggle" class="test">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return {
                toggle,
                click,
                beforeEnterSpy,
                onEnterSpy,
                afterEnterSpy,
                beforeLeaveSpy,
                onLeaveSpy,
                afterLeaveSpy,
              }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        expect(beforeLeaveSpy).toBeCalled()
        expect(onLeaveSpy).toBeCalled()
        expect(afterLeaveSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        expect(afterLeaveSpy).not.toBeCalled()
        await transitionFinish()
        expect(await isVisible('.test')).toBe(false)
        expect(afterLeaveSpy).toBeCalled()

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        expect(beforeEnterSpy).toBeCalled()
        expect(onEnterSpy).toBeCalled()
        expect(afterEnterSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        expect(afterEnterSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div class="test" style="">content</div>',
        )
        expect(afterEnterSpy).toBeCalled()
      },
      E2E_TIMEOUT,
    )

    test(
      'onLeaveCancelled (v-show only)',
      async () => {
        const onLeaveCancelledSpy = vi.fn()

        await page().exposeFunction('onLeaveCancelledSpy', onLeaveCancelledSpy)
        await page().evaluate(() => {
          const { onLeaveCancelledSpy } = window as any
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition name="test" @leave-cancelled="onLeaveCancelledSpy()">
                <div v-show="toggle" class="test">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click, onLeaveCancelledSpy }
            },
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')
        expect(await isVisible('.test')).toBe(true)

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])

        // cancel (enter)
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        expect(onLeaveCancelledSpy).toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div class="test" style="">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'transition on appear with v-show',
      async () => {
        const beforeEnterSpy = vi.fn()
        const onEnterSpy = vi.fn()
        const afterEnterSpy = vi.fn()

        await page().exposeFunction('onEnterSpy', onEnterSpy)
        await page().exposeFunction('beforeEnterSpy', beforeEnterSpy)
        await page().exposeFunction('afterEnterSpy', afterEnterSpy)

        const appearClass = await page().evaluate(async () => {
          const { createApp, ref } = (window as any).Vue
          const { beforeEnterSpy, onEnterSpy, afterEnterSpy } = window as any
          createApp({
            template: `
              <div id="container">
                <transition name="test"
                            appear
                            appear-from-class="test-appear-from"
                            appear-to-class="test-appear-to"
                            appear-active-class="test-appear-active"
                            @before-enter="beforeEnterSpy()"
                            @enter="onEnterSpy()"
                            @after-enter="afterEnterSpy()">
                  <div v-show="toggle" class="test">content</div>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return {
                toggle,
                click,
                beforeEnterSpy,
                onEnterSpy,
                afterEnterSpy,
              }
            },
          }).mount('#app')
          return Promise.resolve().then(() => {
            return document.querySelector('.test')!.className.split(/\s+/g)
          })
        })

        expect(beforeEnterSpy).toBeCalledTimes(1)
        expect(onEnterSpy).toBeCalledTimes(1)
        expect(afterEnterSpy).toBeCalledTimes(0)

        // appear
        expect(appearClass).toStrictEqual([
          'test',
          'test-appear-from',
          'test-appear-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-appear-active',
          'test-appear-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')

        expect(beforeEnterSpy).toBeCalledTimes(1)
        expect(onEnterSpy).toBeCalledTimes(1)
        expect(afterEnterSpy).toBeCalledTimes(1)

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish()
        expect(await isVisible('.test')).toBe(false)

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div class="test" style="">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    // #4845
    test(
      'transition events should not call onEnter with v-show false',
      async () => {
        const beforeEnterSpy = vi.fn()
        const onEnterSpy = vi.fn()
        const afterEnterSpy = vi.fn()

        await page().exposeFunction('onEnterSpy', onEnterSpy)
        await page().exposeFunction('beforeEnterSpy', beforeEnterSpy)
        await page().exposeFunction('afterEnterSpy', afterEnterSpy)

        await page().evaluate(() => {
          const { beforeEnterSpy, onEnterSpy, afterEnterSpy } = window as any
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition
                name="test"
                appear
                @before-enter="beforeEnterSpy()"
                @enter="onEnterSpy()"
                @after-enter="afterEnterSpy()">
                <div v-show="toggle" class="test">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(false)
              const click = () => (toggle.value = !toggle.value)
              return {
                toggle,
                click,
                beforeEnterSpy,
                onEnterSpy,
                afterEnterSpy,
              }
            },
          }).mount('#app')
        })
        await nextTick()

        expect(await isVisible('.test')).toBe(false)

        expect(beforeEnterSpy).toBeCalledTimes(0)
        expect(onEnterSpy).toBeCalledTimes(0)
        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        expect(beforeEnterSpy).toBeCalledTimes(1)
        expect(onEnterSpy).toBeCalledTimes(1)
        expect(afterEnterSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        expect(afterEnterSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div class="test" style="">content</div>',
        )
        expect(afterEnterSpy).toBeCalled()
      },
      E2E_TIMEOUT,
    )
  })

  describe('explicit durations', () => {
    test(
      'single value',
      async () => {
        await page().evaluate(duration => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <div id="container">
                <transition name="test" duration="${duration * 2}">
                  <div v-if="toggle" class="test">content</div>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        }, duration)
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'enter with explicit durations',
      async () => {
        await page().evaluate(duration => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <div id="container">
                <transition name="test" :duration="{ enter: ${duration * 2} }">
                  <div v-if="toggle" class="test">content</div>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        }, duration)
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'leave with explicit durations',
      async () => {
        await page().evaluate(duration => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <div id="container">
                <transition name="test" :duration="{ leave: ${duration * 2} }">
                  <div v-if="toggle" class="test">content</div>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        }, duration)
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'separate enter and leave',
      async () => {
        await page().evaluate(duration => {
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
              <div id="container">
                <transition name="test" :duration="{
                  enter: ${duration * 4},
                  leave: ${duration * 2}
                }">
                  <div v-if="toggle" class="test">content</div>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            },
          }).mount('#app')
        }, duration)
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to',
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active',
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to',
        ])
        await transitionFinish(duration * 4)
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'warn invalid durations',
      async () => {
        createApp({
          template: `
            <div id="container">
              <transition name="test" :duration="NaN">
                <div class="test">content</div>
              </transition>
            </div>
          `,
        }).mount(document.createElement('div'))
        expect(
          `[Vue warn]: <transition> explicit duration is NaN - ` +
            'the duration expression might be incorrect.',
        ).toHaveBeenWarned()

        createApp({
          template: `
            <div id="container">
              <transition name="test" :duration="{
                enter: {},
                leave: {}
              }">
                <div class="test">content</div>
              </transition>
            </div>
          `,
        }).mount(document.createElement('div'))
        expect(
          `[Vue warn]: <transition> explicit duration is not a valid number - ` +
            `got ${JSON.stringify({})}`,
        ).toHaveBeenWarned()
      },
      E2E_TIMEOUT,
    )
  })

  test('reflow after *-leave-from before *-leave-active', async () => {
    await page().evaluate(() => {
      const { createApp, ref } = (window as any).Vue
      createApp({
        template: `
          <div id="container">
            <transition name="test-reflow">
              <div v-if="toggle" class="test-reflow">content</div>
            </transition>
          </div>
          <button id="toggleBtn" @click="click">button</button>
        `,
        setup: () => {
          const toggle = ref(false)
          const click = () => (toggle.value = !toggle.value)
          return {
            toggle,
            click,
          }
        },
      }).mount('#app')
    })

    // if transition starts while there's v-leave-active added along with v-leave-from, its bad, it has to start when it doesnt have the v-leave-from

    // enter
    await classWhenTransitionStart()
    await transitionFinish()

    // leave
    expect(await classWhenTransitionStart()).toStrictEqual([
      'test-reflow',
      'test-reflow-leave-from',
      'test-reflow-leave-active',
    ])

    expect(await style('.test-reflow', 'opacity')).toStrictEqual('0.9')

    await nextFrame()
    expect(await classList('.test-reflow')).toStrictEqual([
      'test-reflow',
      'test-reflow-leave-active',
      'test-reflow-leave-to',
    ])

    await transitionFinish()
    expect(await html('#container')).toBe('<!--v-if-->')
  })

  test('warn when used on multiple elements', async () => {
    createApp({
      render() {
        return h(Transition, null, {
          default: () => [h('div'), h('div')],
        })
      },
    }).mount(document.createElement('div'))
    expect(
      '<transition> can only be used on a single element or component',
    ).toHaveBeenWarned()
  })

  test('warn when invalid transition mode', () => {
    createApp({
      template: `
        <div id="container">
          <transition name="test" mode="none">
            <div class="test">content</div>
          </transition>
        </div>
      `,
    }).mount(document.createElement('div'))
    expect(`invalid <transition> mode: none`).toHaveBeenWarned()
  })

  // #3227
  test(`HOC w/ merged hooks`, async () => {
    const innerSpy = vi.fn()
    const outerSpy = vi.fn()

    const MyTransition = {
      render(this: any) {
        return h(
          Transition,
          {
            onLeave(el, end) {
              innerSpy()
              end()
            },
          },
          this.$slots.default,
        )
      },
    }

    const toggle = ref(true)

    const root = document.createElement('div')
    createApp({
      render() {
        return h(MyTransition, { onLeave: () => outerSpy() }, () =>
          toggle.value ? h('div') : null,
        )
      },
    }).mount(root)

    expect(root.innerHTML).toBe(`<div></div>`)

    toggle.value = false
    await nextTick()
    expect(innerSpy).toHaveBeenCalledTimes(1)
    expect(outerSpy).toHaveBeenCalledTimes(1)
    expect(root.innerHTML).toBe(`<!---->`)
  })

  test(
    'should work with dev root fragment',
    async () => {
      await page().evaluate(() => {
        const { createApp, ref } = (window as any).Vue
        createApp({
          components: {
            Comp: {
              template: `
                  <!-- Broken! -->
                  <div><slot /></div>
                `,
            },
          },
          template: `
            <div id="container">
              <transition>
                <Comp class="test" v-if="toggle">
                  <div>content</div>
                </Comp>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
          setup: () => {
            const toggle = ref(true)
            const click = () => (toggle.value = !toggle.value)
            return { toggle, click }
          },
        }).mount('#app')
      })
      expect(await html('#container')).toBe(
        '<!-- Broken! --><div class="test"><div>content</div></div>',
      )

      // leave
      expect(await classWhenTransitionStart()).toStrictEqual([
        'test',
        'v-leave-from',
        'v-leave-active',
      ])
      await nextFrame()
      expect(await classList('.test')).toStrictEqual([
        'test',
        'v-leave-active',
        'v-leave-to',
      ])
      await transitionFinish()
      expect(await html('#container')).toBe('<!--v-if-->')

      // enter
      expect(await classWhenTransitionStart()).toStrictEqual([
        'test',
        'v-enter-from',
        'v-enter-active',
      ])
      await nextFrame()
      expect(await classList('.test')).toStrictEqual([
        'test',
        'v-enter-active',
        'v-enter-to',
      ])
      await transitionFinish()
      expect(await html('#container')).toBe(
        '<!-- Broken! --><div class="test"><div>content</div></div>',
      )
    },
    E2E_TIMEOUT,
  )

  // https://github.com/vuejs/core/issues/12181#issuecomment-2414380955
  describe('not leaking', async () => {
    test('switching VNodes', async () => {
      const client = await page().createCDPSession()
      await page().evaluate(async () => {
        const { createApp, ref, nextTick } = (window as any).Vue
        const empty = ref(true)

        createApp({
          components: {
            Child: {
              setup: () => {
                // Big arrays kick GC earlier
                const test = ref([...Array(30_000_000)].map((_, i) => ({ i })))
                // TODO: Use a diferent TypeScript env for testing
                // @ts-expect-error - Custom property and same lib as runtime is used
                window.__REF__ = new WeakRef(test)

                return { test }
              },
              template: `
                <p>{{ test.length }}</p>
              `,
            },
            Empty: {
              template: '<div></div>',
            },
          },
          template: `
            <transition>
              <component :is="empty ? 'Empty' : 'Child'" />
            </transition>
          `,
          setup() {
            return { empty }
          },
        }).mount('#app')

        await nextTick()
        empty.value = false
        await nextTick()
        empty.value = true
        await nextTick()
      })

      const isCollected = async () =>
        // @ts-expect-error - Custom property
        await page().evaluate(() => window.__REF__.deref() === undefined)

      while ((await isCollected()) === false) {
        await client.send('HeapProfiler.collectGarbage')
      }

      expect(await isCollected()).toBe(true)
    })

    // https://github.com/vuejs/core/issues/12181#issue-2588232334
    test('switching deep vnodes edge case', async () => {
      const client = await page().createCDPSession()
      await page().evaluate(async () => {
        const { createApp, ref, nextTick } = (window as any).Vue
        const shown = ref(false)

        createApp({
          components: {
            Child: {
              setup: () => {
                // Big arrays kick GC earlier
                const test = ref([...Array(30_000_000)].map((_, i) => ({ i })))
                // TODO: Use a diferent TypeScript env for testing
                // @ts-expect-error - Custom property and same lib as runtime is used
                window.__REF__ = new WeakRef(test)

                return { test }
              },
              template: `
                <p>{{ test.length }}</p>
              `,
            },
            Wrapper: {
              template: `
                <transition>
                  <div v-if="true">
                    <slot />
                  </div>
                </transition>
              `,
            },
          },
          template: `
            <button id="toggleBtn" @click="shown = !shown">{{ shown ? 'Hide' : 'Show' }}</button>
            <Wrapper>
              <Child v-if="shown" />
              <div v-else></div>
            </Wrapper>
          `,
          setup() {
            return { shown }
          },
        }).mount('#app')

        await nextTick()
        shown.value = true
        await nextTick()
        shown.value = false
        await nextTick()
      })

      const isCollected = async () =>
        // @ts-expect-error - Custom property
        await page().evaluate(() => window.__REF__.deref() === undefined)

      while ((await isCollected()) === false) {
        await client.send('HeapProfiler.collectGarbage')
      }

      expect(await isCollected()).toBe(true)
    })
  })
})
