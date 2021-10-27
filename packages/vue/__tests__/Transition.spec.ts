import { E2E_TIMEOUT, setupPuppeteer } from './e2eUtils'
import path from 'path'
import { h, createApp, Transition, ref, nextTick } from 'vue'

describe('e2e: Transition', () => {
  const { page, html, classList, isVisible, timeout, nextFrame, click } =
    setupPuppeteer()
  const baseUrl = `file://${path.resolve(__dirname, './transition.html')}`

  const duration = process.env.CI ? 200 : 50
  const buffer = process.env.CI ? 20 : 5

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
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-leave-from',
          'v-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-leave-active',
          'v-leave-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-enter-from',
          'v-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-enter-active',
          'v-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'bye-from',
          'bye-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'bye-active',
          'bye-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'hello-from',
          'hello-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'hello-active',
          'hello-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
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
          'changed-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'changed-enter-active',
          'changed-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
    )

    test(
      'transition events without appear',
      async () => {
        const beforeLeaveSpy = jest.fn()
        const onLeaveSpy = jest.fn()
        const afterLeaveSpy = jest.fn()
        const beforeEnterSpy = jest.fn()
        const onEnterSpy = jest.fn()
        const afterEnterSpy = jest.fn()

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
            afterLeaveSpy
          } = window as any
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition
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
                beforeEnterSpy,
                onEnterSpy,
                afterEnterSpy,
                beforeLeaveSpy,
                onLeaveSpy,
                afterLeaveSpy
              }
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        // todo test event with arguments. Note: not get dom, get object. '{}'
        expect(beforeLeaveSpy).toBeCalled()
        expect(onLeaveSpy).toBeCalled()
        expect(afterLeaveSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        expect(afterLeaveSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')
        expect(afterLeaveSpy).toBeCalled()

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        expect(beforeEnterSpy).toBeCalled()
        expect(onEnterSpy).toBeCalled()
        expect(afterEnterSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        expect(afterEnterSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
        expect(afterEnterSpy).toBeCalled()
      },
      E2E_TIMEOUT
    )

    test('onEnterCancelled', async () => {
      const enterCancelledSpy = jest.fn()

      await page().exposeFunction('enterCancelledSpy', enterCancelledSpy)

      await page().evaluate(() => {
        const { enterCancelledSpy } = window as any
        const { createApp, ref } = (window as any).Vue
        createApp({
          template: `
            <div id="container">
              <transition
                name="test"
                @enter-cancelled="enterCancelledSpy">
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
              enterCancelledSpy
            }
          }
        }).mount('#app')
      })
      expect(await html('#container')).toBe('<!--v-if-->')

      // enter
      expect(await classWhenTransitionStart()).toStrictEqual([
        'test',
        'test-enter-from',
        'test-enter-active'
      ])
      await nextFrame()
      expect(await classList('.test')).toStrictEqual([
        'test',
        'test-enter-active',
        'test-enter-to'
      ])

      // cancel (leave)
      expect(await classWhenTransitionStart()).toStrictEqual([
        'test',
        'test-leave-from',
        'test-leave-active'
      ])
      expect(enterCancelledSpy).toBeCalled()
      await nextFrame()
      expect(await classList('.test')).toStrictEqual([
        'test',
        'test-leave-active',
        'test-leave-to'
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
            }
          }).mount('#app')
          return Promise.resolve().then(() => {
            return document.querySelector('.test')!.className.split(/\s+/g)
          })
        })
        // appear
        expect(appearClass).toStrictEqual([
          'test',
          'test-appear-from',
          'test-appear-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-appear-active',
          'test-appear-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
    )

    test(
      'transition events with appear',
      async () => {
        const onLeaveSpy = jest.fn()
        const onEnterSpy = jest.fn()
        const onAppearSpy = jest.fn()
        const beforeLeaveSpy = jest.fn()
        const beforeEnterSpy = jest.fn()
        const beforeAppearSpy = jest.fn()
        const afterLeaveSpy = jest.fn()
        const afterEnterSpy = jest.fn()
        const afterAppearSpy = jest.fn()

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
            afterLeaveSpy
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
                  @before-enter="beforeEnterSpy"
                  @enter="onEnterSpy"
                  @after-enter="afterEnterSpy"
                  @before-leave="beforeLeaveSpy"
                  @leave="onLeaveSpy"
                  @after-leave="afterLeaveSpy"
                  @before-appear="beforeAppearSpy"
                  @appear="onAppearSpy"
                  @after-appear="afterAppearSpy">
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
                afterLeaveSpy
              }
            }
          }).mount('#app')
          return Promise.resolve().then(() => {
            return document.querySelector('.test')!.className.split(/\s+/g)
          })
        })
        // appear
        expect(appearClass).toStrictEqual([
          'test',
          'test-appear-from',
          'test-appear-active'
        ])
        expect(beforeAppearSpy).toBeCalled()
        expect(onAppearSpy).toBeCalled()
        expect(afterAppearSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-appear-active',
          'test-appear-to'
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
          'test-leave-active'
        ])
        expect(beforeLeaveSpy).toBeCalled()
        expect(onLeaveSpy).toBeCalled()
        expect(afterLeaveSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        expect(afterLeaveSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')
        expect(afterLeaveSpy).toBeCalled()

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        expect(beforeEnterSpy).toBeCalled()
        expect(onEnterSpy).toBeCalled()
        expect(afterEnterSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        expect(afterEnterSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
        expect(afterEnterSpy).toBeCalled()
      },
      E2E_TIMEOUT
    )

    test(
      'css: false',
      async () => {
        const onBeforeEnterSpy = jest.fn()
        const onEnterSpy = jest.fn()
        const onAfterEnterSpy = jest.fn()
        const onBeforeLeaveSpy = jest.fn()
        const onLeaveSpy = jest.fn()
        const onAfterLeaveSpy = jest.fn()

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
            onAfterLeaveSpy
          } = window as any
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition
                :css="false"
                name="test"
                @before-enter="onBeforeEnterSpy"
                @enter="onEnterSpy"
                @after-enter="onAfterEnterSpy"
                @before-leave="onBeforeLeaveSpy"
                @leave="onLeaveSpy"
                @after-leave="onAfterLeaveSpy">
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
                onAfterLeaveSpy
              }
            }
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
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div>content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'noop-leave-from',
          'noop-leave-active'
        ])
        await nextFrame()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'noop-enter-from',
          'noop-enter-active'
        ])
        await nextFrame()
        expect(await html('#container')).toBe('<div class="">content</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div>content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test-anim-leave-from',
          'test-anim-leave-active'
        ])
        await nextFrame()
        expect(await classList('#container div')).toStrictEqual([
          'test-anim-leave-active',
          'test-anim-leave-to'
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test-anim-enter-from',
          'test-anim-enter-active'
        ])
        await nextFrame()
        expect(await classList('#container div')).toStrictEqual([
          'test-anim-enter-active',
          'test-anim-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="">content</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div>content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test-anim-long-leave-from',
          'test-anim-long-leave-active'
        ])
        await nextFrame()
        expect(await classList('#container div')).toStrictEqual([
          'test-anim-long-leave-active',
          'test-anim-long-leave-to'
        ])

        if (!process.env.CI) {
          await new Promise(r => {
            setTimeout(r, duration - buffer)
          })
          expect(await classList('#container div')).toStrictEqual([
            'test-anim-long-leave-active',
            'test-anim-long-leave-to'
          ])
        }

        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test-anim-long-enter-from',
          'test-anim-long-enter-active'
        ])
        await nextFrame()
        expect(await classList('#container div')).toStrictEqual([
          'test-anim-long-enter-active',
          'test-anim-long-enter-to'
        ])

        if (!process.env.CI) {
          await new Promise(r => {
            setTimeout(r, duration - buffer)
          })
          expect(await classList('#container div')).toStrictEqual([
            'test-anim-long-enter-active',
            'test-anim-long-enter-to'
          ])
        }

        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<div class="">content</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe(
          '<circle cx="0" cy="0" r="10" class="test"></circle>'
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
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await svgTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<circle cx="0" cy="0" r="10" class="test"></circle>'
        )
      },
      E2E_TIMEOUT
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
              }
            },
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
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
                template: '<div v-if="false">one</div>'
              },
              two: {
                template: '<div>two</div>'
              }
            },
            setup: () => {
              const toggle = ref(true)
              const view = ref('one')
              const click = () => (toggle.value = !toggle.value)
              const change = () =>
                (view.value = view.value === 'one' ? 'two' : 'one')
              return { toggle, click, change, view }
            }
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
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
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
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')
      },
      E2E_TIMEOUT
    )
  })

  describe('transition with Suspense', () => {
    // #1583
    test(
      'async component transition inside Suspense',
      async () => {
        const onLeaveSpy = jest.fn()
        const onEnterSpy = jest.fn()

        await page().exposeFunction('onLeaveSpy', onLeaveSpy)
        await page().exposeFunction('onEnterSpy', onEnterSpy)

        await page().evaluate(() => {
          const { onEnterSpy, onLeaveSpy } = window as any
          const { createApp, ref, h } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition @enter="onEnterSpy" @leave="onLeaveSpy">
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
                }
              }
            },
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click, onEnterSpy, onLeaveSpy }
            }
          }).mount('#app')
        })

        expect(onEnterSpy).toBeCalledTimes(1)
        await nextFrame()
        expect(await html('#container')).toBe(
          '<div class="test v-enter-active v-enter-to">content</div>'
        )
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-leave-from',
          'v-leave-active'
        ])
        expect(onLeaveSpy).toBeCalledTimes(1)
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-leave-active',
          'v-leave-to'
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
          'v-enter-active'
        ])
        expect(onEnterSpy).toBeCalledTimes(2)
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-enter-active',
          'v-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-leave-from',
          'v-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-leave-active',
          'v-leave-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'v-enter-from',
          'v-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'v-enter-active',
          'v-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
    )

    test(
      'out-in mode with Suspense',
      async () => {
        const onLeaveSpy = jest.fn()
        const onEnterSpy = jest.fn()

        await page().exposeFunction('onLeaveSpy', onLeaveSpy)
        await page().exposeFunction('onEnterSpy', onEnterSpy)

        await page().evaluate(() => {
          const { createApp, shallowRef, h } = (window as any).Vue
          const One = {
            async setup() {
              return () => h('div', { class: 'test' }, 'one')
            }
          }
          const Two = {
            async setup() {
              return () => h('div', { class: 'test' }, 'two')
            }
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
            }
          }).mount('#app')
        })

        await nextFrame()
        expect(await html('#container')).toBe(
          '<div class="test v-enter-active v-enter-to">one</div>'
        )
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">one</div>')

        // leave
        await classWhenTransitionStart()
        await nextFrame()
        expect(await html('#container')).toBe(
          '<div class="test v-leave-active v-leave-to">one</div>'
        )
        await transitionFinish()
        await nextFrame()
        // expect(await html('#container')).toBe(
        //   '<div class="test v-enter-active v-enter-to">two</div>'
        // )
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">two</div>')
      },
      E2E_TIMEOUT
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
                // @ts-ignore
                window.resolve = () =>
                  _resolve({
                    msg: 'success'
                  })
              })
            }
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
            }
          }).mount('#app')
        })

        expect(await html('#container')).toBe('<!---->')

        await click('#toggleBtn')
        await nextFrame()
        expect(await html('#container')).toBe('<div class="">Loading...</div>')

        await page().evaluate(() => {
          // @ts-ignore
          window.resolve()
        })

        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<div class="">success</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')
        expect(await isVisible('.test')).toBe(true)

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish()
        expect(await isVisible('.test')).toBe(false)

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div class="test" style="">content</div>'
        )
      },
      E2E_TIMEOUT
    )

    test(
      'transition events with v-show',
      async () => {
        const beforeLeaveSpy = jest.fn()
        const onLeaveSpy = jest.fn()
        const afterLeaveSpy = jest.fn()
        const beforeEnterSpy = jest.fn()
        const onEnterSpy = jest.fn()
        const afterEnterSpy = jest.fn()

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
            afterLeaveSpy
          } = window as any
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition
                name="test"
                @before-enter="beforeEnterSpy"
                @enter="onEnterSpy"
                @after-enter="afterEnterSpy"
                @before-leave="beforeLeaveSpy"
                @leave="onLeaveSpy"
                @after-leave="afterLeaveSpy">
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
                afterLeaveSpy
              }
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        expect(beforeLeaveSpy).toBeCalled()
        expect(onLeaveSpy).toBeCalled()
        expect(afterLeaveSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        expect(afterLeaveSpy).not.toBeCalled()
        await transitionFinish()
        expect(await isVisible('.test')).toBe(false)
        expect(afterLeaveSpy).toBeCalled()

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        expect(beforeEnterSpy).toBeCalled()
        expect(onEnterSpy).toBeCalled()
        expect(afterEnterSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        expect(afterEnterSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div class="test" style="">content</div>'
        )
        expect(afterEnterSpy).toBeCalled()
      },
      E2E_TIMEOUT
    )

    test(
      'onLeaveCancelled (v-show only)',
      async () => {
        const onLeaveCancelledSpy = jest.fn()

        await page().exposeFunction('onLeaveCancelledSpy', onLeaveCancelledSpy)
        await page().evaluate(() => {
          const { onLeaveCancelledSpy } = window as any
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition name="test" @leave-cancelled="onLeaveCancelledSpy">
                <div v-show="toggle" class="test">content</div>
              </transition>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click, onLeaveCancelledSpy }
            }
          }).mount('#app')
        })
        expect(await html('#container')).toBe('<div class="test">content</div>')
        expect(await isVisible('.test')).toBe(true)

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])

        // cancel (enter)
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        expect(onLeaveCancelledSpy).toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div class="test" style="">content</div>'
        )
      },
      E2E_TIMEOUT
    )

    test(
      'transition on appear with v-show',
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
                  <div v-show="toggle" class="test">content</div>
                </transition>
              </div>
              <button id="toggleBtn" @click="click">button</button>
            `,
            setup: () => {
              const toggle = ref(true)
              const click = () => (toggle.value = !toggle.value)
              return { toggle, click }
            }
          }).mount('#app')
          return Promise.resolve().then(() => {
            return document.querySelector('.test')!.className.split(/\s+/g)
          })
        })
        // appear
        expect(appearClass).toStrictEqual([
          'test',
          'test-appear-from',
          'test-appear-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-appear-active',
          'test-appear-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish()
        expect(await isVisible('.test')).toBe(false)

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div class="test" style="">content</div>'
        )
      },
      E2E_TIMEOUT
    )

    test(
      'transition events should not call onEnter with v-show false',
      async () => {
        const beforeEnterSpy = jest.fn()
        const onEnterSpy = jest.fn()
        const afterEnterSpy = jest.fn()

        await page().exposeFunction('onEnterSpy', onEnterSpy)
        await page().exposeFunction('beforeEnterSpy', beforeEnterSpy)
        await page().exposeFunction('afterEnterSpy', afterEnterSpy)

        await page().evaluate(() => {
          const {
            beforeEnterSpy,
            onEnterSpy,
            afterEnterSpy,
          } = window as any
          const { createApp, ref } = (window as any).Vue
          createApp({
            template: `
            <div id="container">
              <transition
                name="test"
                appear
                @before-enter="beforeEnterSpy"
                @enter="onEnterSpy"
                @after-enter="afterEnterSpy"
                @before-leave="beforeLeaveSpy"
                @leave="onLeaveSpy"
                @after-leave="afterLeaveSpy">
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
            }
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
          'test-enter-active'
        ])
        expect(beforeEnterSpy).toBeCalledTimes(1)
        expect(onEnterSpy).toBeCalledTimes(1)
        expect(afterEnterSpy).not.toBeCalled()
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        expect(afterEnterSpy).not.toBeCalled()
        await transitionFinish()
        expect(await html('#container')).toBe(
          '<div class="test" style="">content</div>'
        )
        expect(afterEnterSpy).toBeCalled()
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        }, duration)
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        }, duration)
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        }, duration)
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish()
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
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
            }
          }).mount('#app')
        }, duration)
        expect(await html('#container')).toBe('<div class="test">content</div>')

        // leave
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-leave-from',
          'test-leave-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-leave-active',
          'test-leave-to'
        ])
        await transitionFinish(duration * 2)
        expect(await html('#container')).toBe('<!--v-if-->')

        // enter
        expect(await classWhenTransitionStart()).toStrictEqual([
          'test',
          'test-enter-from',
          'test-enter-active'
        ])
        await nextFrame()
        expect(await classList('.test')).toStrictEqual([
          'test',
          'test-enter-active',
          'test-enter-to'
        ])
        await transitionFinish(duration * 4)
        expect(await html('#container')).toBe('<div class="test">content</div>')
      },
      E2E_TIMEOUT
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
          `
        }).mount(document.createElement('div'))
        expect(
          `[Vue warn]: <transition> explicit duration is NaN - ` +
            'the duration expression might be incorrect.'
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
          `
        }).mount(document.createElement('div'))
        expect(
          `[Vue warn]: <transition> explicit duration is not a valid number - ` +
            `got ${JSON.stringify({})}`
        ).toHaveBeenWarned()
      },
      E2E_TIMEOUT
    )
  })

  test('warn when used on multiple elements', async () => {
    createApp({
      render() {
        return h(Transition, null, {
          default: () => [h('div'), h('div')]
        })
      }
    }).mount(document.createElement('div'))
    expect(
      '<transition> can only be used on a single element or component'
    ).toHaveBeenWarned()
  })

  // #3227
  test(`HOC w/ merged hooks`, async () => {
    const innerSpy = jest.fn()
    const outerSpy = jest.fn()

    const MyTransition = {
      render(this: any) {
        return h(
          Transition,
          {
            onLeave(el, end) {
              innerSpy()
              end()
            }
          },
          this.$slots.default
        )
      }
    }

    const toggle = ref(true)

    const root = document.createElement('div')
    createApp({
      render() {
        return h(MyTransition, { onLeave: () => outerSpy() }, () =>
          toggle.value ? h('div') : null
        )
      }
    }).mount(root)

    expect(root.innerHTML).toBe(`<div></div>`)

    toggle.value = false
    await nextTick()
    expect(innerSpy).toHaveBeenCalledTimes(1)
    expect(outerSpy).toHaveBeenCalledTimes(1)
    expect(root.innerHTML).toBe(`<!---->`)
  })
})
