import { E2E_TIMEOUT, setupBrowserE2E } from './e2eBrowserUtils'

describe('e2e: TransitionGroup', () => {
  const { page, reset, html, nextFrame, timeout } = setupBrowserE2E()

  const duration = 50
  const buffer = 20

  const htmlWhenTransitionStart = () =>
    page().evaluate(() => {
      ;(document.querySelector('#toggleBtn') as any)!.click()
      return Promise.resolve().then(() => {
        return document.querySelector('#container')!.innerHTML
      })
    })

  const transitionFinish = (time = duration) => timeout(time + buffer)

  // id, top and classes of the matched elements right before the click and
  // when the move transitions start, i.e. where the FLIP translation holds them
  const layoutWhenTransitionStart = (selector: string) =>
    page().evaluate(selector => {
      const layout = () =>
        Array.from(document.querySelectorAll(selector)).map(node => ({
          id: node.id,
          top: Math.round(node.getBoundingClientRect().top),
          classes: Array.from(node.classList),
        }))
      const before = layout()
      ;(document.querySelector('#toggleBtn') as any)!.click()
      return Promise.resolve().then(() => ({ before, start: layout() }))
    }, selector)

  beforeEach(async () => {
    await reset()
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
    'v-show enter does not also run move transition',
    async () => {
      await page().evaluate(duration => {
        const { createApp, ref, onMounted } = (window as any).Vue
        createApp({
          template: `
            <div id="container">
              <transition-group name="show-group" tag="div" id="showGroup">
                <div
                  v-for="item in items"
                  :key="item"
                  :id="\`show-\${item}\`"
                  v-show="visibleItems.includes(item)"
                  class="show-item"
                >
                  {{ item }}
                </div>
              </transition-group>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
          setup: () => {
            const items = ref(['a', 'b', 'c'])
            const visibleItems = ref(['a', 'c'])
            const click = () => (visibleItems.value = ['a', 'b', 'c'])

            onMounted(() => {
              const styleNode = document.createElement('style')
              styleNode.textContent = `
                #showGroup {
                  display: flex;
                  gap: 5px;
                }
                #showGroup > .show-item {
                  width: 100px;
                  height: 20px;
                }
                .show-group-enter-active,
                .show-group-move {
                  transition: transform ${duration}ms ease;
                }
                .show-group-enter-from {
                  transform: translateX(1000px);
                }
              `
              document.head.appendChild(styleNode)
            })

            return { click, items, visibleItems }
          },
        }).mount('#app')
      }, duration)

      const duringTransition = await page().evaluate(() => {
        ;(document.querySelector('#toggleBtn') as any)!.click()
        return Promise.resolve().then(() =>
          Array.from(document.querySelectorAll('.show-item')).map(node => ({
            text: node.textContent!.trim(),
            classes: Array.from(node.classList),
            inlineTransform: (node as HTMLElement).style.transform,
          })),
        )
      })

      expect(duringTransition).toStrictEqual([
        {
          text: 'a',
          classes: ['show-item'],
          inlineTransform: '',
        },
        {
          text: 'b',
          classes: [
            'show-item',
            'show-group-enter-from',
            'show-group-enter-active',
          ],
          inlineTransform: '',
        },
        {
          text: 'c',
          classes: ['show-item', 'show-group-move'],
          inlineTransform: '',
        },
      ])

      await transitionFinish()
    },
    E2E_TIMEOUT,
  )

  test(
    'move while entering',
    async () => {
      await page().evaluate(duration => {
        const { createApp, ref, onMounted } = (window as any).Vue
        createApp({
          template: `
              <transition-group name="toasts" tag="div" id="toasts">
                <div class="toast" v-for="toast in list" :key="toast.id">
                  {{ toast.text }} #{{ toast.id }}
                </div>
              </transition-group>
              <button id="addBtn" @click="add">button</button>
            `,
          setup: () => {
            const list = ref([])
            let id = 0
            const add = () => {
              if (list.value.length > 3) {
                list.value.splice(0, 1)
              }
              list.value.push({
                id,
                type: 'error',
                text: 'Test message',
              })
              id++
            }

            onMounted(() => {
              const styleNode = document.createElement('style')
              styleNode.innerHTML = `
                #toasts {
                  position: absolute;
                  bottom: 0;
                  left: 0;
                }
                #toasts > .toast {
                  width: 150px;
                  margin-bottom: 10px;
                  height: 30px;
                  color: white;
                  background: black;
                }
                .toasts-leave-active {
                  position: absolute;
                }
                .toasts-move { transition: transform ${duration}ms ease; }
              `
              document.body.appendChild(styleNode)
            })

            return { list, add }
          },
        }).mount('#app')
      }, duration)

      const overlapDelay = Math.max(10, Math.floor(duration / 2))
      const { midTop, finalTop } = await page().evaluate(
        ({ overlapDelay, duration, buffer }) => {
          ;(document.querySelector('#addBtn') as any)!.click()
          return new Promise<{ midTop: number; finalTop: number }>(resolve => {
            setTimeout(() => {
              ;(document.querySelector('#addBtn') as any)!.click()
              Promise.resolve().then(() => {
                const nodes = Array.from(
                  document.querySelectorAll('#toasts .toast'),
                ) as HTMLElement[]
                const firstToast = nodes.find(node =>
                  node.textContent?.includes('#0'),
                )
                const midTop = firstToast
                  ? firstToast.getBoundingClientRect().top
                  : NaN
                setTimeout(() => {
                  const finalTop = firstToast
                    ? firstToast.getBoundingClientRect().top
                    : NaN
                  resolve({ midTop, finalTop })
                }, duration + buffer)
              })
            }, overlapDelay)
          })
        },
        { overlapDelay, duration, buffer },
      )

      expect(midTop).toBeGreaterThan(finalTop)
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
    const { createApp, ref } = (window as any).Vue
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
    const { createApp } = (window as any).Vue
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
                <div key="1" class="test">foo</div>
                <div key="2" class="test" v-if="show">bar</div>
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

  // #6105
  test(
    'with scale',
    async () => {
      await page().evaluate(() => {
        const { createApp, ref, onMounted } = (window as any).Vue
        createApp({
          template: `
            <div id="container">
              <div class="scale" style="transform: scale(2) translateX(50%) translateY(50%)">
                <transition-group tag="ul">
                  <li v-for="item in items" :key="item">{{item}}</li>
                </transition-group>
                <button id="toggleBtn" @click="click">button</button>
              </div>
            </div>
          `,
          setup: () => {
            const items = ref(['a', 'b', 'c'])
            const click = () => {
              items.value.reverse()
            }

            onMounted(() => {
              const styleNode = document.createElement('style')
              styleNode.innerHTML = `.v-move {
                transition: transform 0.5s ease;
              }`
              document.body.appendChild(styleNode)
            })

            return { items, click }
          },
        }).mount('#app')
      })

      const original_top = await page().$eval('ul li:nth-child(1)', node => {
        return node.getBoundingClientRect().top
      })
      const new_top = await page().evaluate(() => {
        const el = document.querySelector('ul li:nth-child(1)')
        const p = new Promise(resolve => {
          el!.addEventListener('transitionstart', () => {
            const new_top = el!.getBoundingClientRect().top
            resolve(new_top)
          })
        })
        ;(document.querySelector('#toggleBtn') as any)!.click()
        return p
      })

      // transitionstart can fire at zero progress, before the element moves.
      expect(original_top).toBeLessThanOrEqual(new_top as number)
    },
    E2E_TIMEOUT,
  )

  // #5385, #1531: nested groups a1/a2 and b1/b2 inside outer items a and b, with
  // the outer group's children replaced by `next` on click
  const nestedGroupsWhenTransitionStart = async (
    moveClasses: string,
    next: { id: string; items: string[] }[],
  ) => {
    await page().evaluate(
      ({ duration, moveClasses, next }) => {
        const { createApp, ref, onMounted } = (window as any).Vue
        createApp({
          template: `
            <div id="container">
              <transition-group name="outer" tag="div">
                <div v-for="group in groups" :key="group.id" :id="group.id" class="outer-item">
                  <transition-group name="inner" tag="div">
                    <div v-for="item in group.items" :key="item" :id="item" class="inner-item">{{ item }}</div>
                  </transition-group>
                </div>
              </transition-group>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
          setup: () => {
            const groups = ref([
              { id: 'a', items: ['a1', 'a2'] },
              { id: 'b', items: ['b1', 'b2'] },
            ])
            const click = () => {
              groups.value = next
            }

            onMounted(() => {
              const styleNode = document.createElement('style')
              styleNode.textContent = `
                .inner-item { height: 30px; }
                ${moveClasses} {
                  transition: transform ${duration}ms ease;
                }
              `
              document.head.appendChild(styleNode)
            })

            return { groups, click }
          },
        }).mount('#app')
      },
      { duration, moveClasses, next },
    )
    const { before, start } = await layoutWhenTransitionStart(
      '.outer-item, .inner-item',
    )
    expect(before.map(({ top }) => top)).toStrictEqual([0, 0, 30, 60, 60, 90])
    return start
  }

  test(
    'nested group moving along with its outer item',
    async () => {
      // a and b swap places while a1 and a2 swap within a: every item starts
      // out where it was, b1/b2 only ride along with their outer item
      const start = await nestedGroupsWhenTransitionStart(
        '.outer-move, .inner-move',
        [
          { id: 'b', items: ['b1', 'b2'] },
          { id: 'a', items: ['a2', 'a1'] },
        ],
      )
      expect(start).toStrictEqual([
        { id: 'b', top: 60, classes: ['outer-item', 'outer-move'] },
        { id: 'b1', top: 60, classes: ['inner-item'] },
        { id: 'b2', top: 90, classes: ['inner-item'] },
        { id: 'a', top: 0, classes: ['outer-item', 'outer-move'] },
        { id: 'a2', top: 30, classes: ['inner-item', 'inner-move'] },
        { id: 'a1', top: 0, classes: ['inner-item', 'inner-move'] },
      ])

      await transitionFinish()
    },
    E2E_TIMEOUT,
  )

  // coverage guard: without a move transition on the outer group, the inner
  // groups animate the whole movement of their items themselves
  test(
    'nested group moving along with an outer item that has no move transition',
    async () => {
      const start = await nestedGroupsWhenTransitionStart('.inner-move', [
        { id: 'b', items: ['b1', 'b2'] },
        { id: 'a', items: ['a2', 'a1'] },
      ])
      expect(start).toStrictEqual([
        { id: 'b', top: 0, classes: ['outer-item'] },
        { id: 'b1', top: 60, classes: ['inner-item', 'inner-move'] },
        { id: 'b2', top: 90, classes: ['inner-item', 'inner-move'] },
        { id: 'a', top: 60, classes: ['outer-item'] },
        { id: 'a2', top: 30, classes: ['inner-item', 'inner-move'] },
        { id: 'a1', top: 0, classes: ['inner-item', 'inner-move'] },
      ])

      await transitionFinish()
    },
    E2E_TIMEOUT,
  )

  // coverage guard: b1/b2 record their old positions after a has already grown,
  // so they must be compared in the same frame as their new positions
  test(
    'nested group pushed down by an earlier outer item growing',
    async () => {
      const start = await nestedGroupsWhenTransitionStart(
        '.outer-move, .inner-move',
        [
          { id: 'a', items: ['a1', 'a2', 'a3'] },
          { id: 'b', items: ['b1', 'b2'] },
        ],
      )
      expect(start).toStrictEqual([
        { id: 'a', top: 0, classes: ['outer-item'] },
        { id: 'a1', top: 0, classes: ['inner-item'] },
        { id: 'a2', top: 30, classes: ['inner-item'] },
        {
          id: 'a3',
          top: 60,
          classes: ['inner-item', 'inner-enter-from', 'inner-enter-active'],
        },
        { id: 'b', top: 60, classes: ['outer-item', 'outer-move'] },
        { id: 'b1', top: 60, classes: ['inner-item'] },
        { id: 'b2', top: 90, classes: ['inner-item'] },
      ])

      await transitionFinish()
    },
    E2E_TIMEOUT,
  )

  // the outer group's updated hook runs first here: the inner group updates
  // through its own job, after a has already moved in the DOM
  test(
    'nested group updating on its own while its outer item moves',
    async () => {
      await page().evaluate(duration => {
        const { createApp, ref, onMounted, defineComponent } = (window as any)
          .Vue
        const items = ref(['a1', 'a2'])
        const Inner = defineComponent({
          template: `
            <transition-group name="inner" tag="div">
              <div v-for="item in items" :key="item" :id="item" class="inner-item">{{ item }}</div>
            </transition-group>
          `,
          setup: () => ({ items }),
        })
        createApp({
          components: { Inner },
          template: `
            <div id="container">
              <transition-group name="outer" tag="div">
                <div v-for="group in groups" :key="group" :id="group" class="outer-item">
                  <Inner v-if="group === 'a'" />
                  <div v-else id="b1" class="inner-item">b1</div>
                </div>
              </transition-group>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
          setup: () => {
            const groups = ref(['a', 'b'])
            const click = () => {
              groups.value = ['b', 'a']
              items.value = ['a2', 'a1']
            }

            onMounted(() => {
              const styleNode = document.createElement('style')
              styleNode.textContent = `
                .inner-item { height: 30px; }
                .outer-move,
                .inner-move {
                  transition: transform ${duration}ms ease;
                }
              `
              document.head.appendChild(styleNode)
            })

            return { groups, click }
          },
        }).mount('#app')
      }, duration)

      const { before, start } = await layoutWhenTransitionStart(
        '.outer-item, .inner-item',
      )
      expect(before.map(({ top }) => top)).toStrictEqual([0, 0, 30, 60, 60])
      expect(start).toStrictEqual([
        { id: 'b', top: 60, classes: ['outer-item', 'outer-move'] },
        { id: 'b1', top: 60, classes: ['inner-item'] },
        { id: 'a', top: 0, classes: ['outer-item', 'outer-move'] },
        { id: 'a2', top: 30, classes: ['inner-item', 'inner-move'] },
        { id: 'a1', top: 0, classes: ['inner-item', 'inner-move'] },
      ])

      await transitionFinish()
    },
    E2E_TIMEOUT,
  )

  // three levels: sections as1/as2 inside outer item a, bs inside b, two items
  // each. On click a and b swap places while as1 and as2 swap within a
  const threeLevelGroupsWhenTransitionStart = async (moveClasses: string) => {
    await page().evaluate(
      ({ duration, moveClasses }) => {
        const { createApp, ref, onMounted } = (window as any).Vue
        createApp({
          template: `
            <div id="container">
              <transition-group name="outer" tag="div">
                <div v-for="group in groups" :key="group.id" :id="group.id" class="outer-item">
                  <transition-group name="middle" tag="div">
                    <section v-for="section in group.sections" :key="section.id" :id="section.id" class="middle-item">
                      <transition-group name="inner" tag="div">
                        <div v-for="item in section.items" :key="item" :id="item" class="inner-item">{{ item }}</div>
                      </transition-group>
                    </section>
                  </transition-group>
                </div>
              </transition-group>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
          setup: () => {
            const groups = ref([
              {
                id: 'a',
                sections: [
                  { id: 'as1', items: ['a1', 'a2'] },
                  { id: 'as2', items: ['a3', 'a4'] },
                ],
              },
              { id: 'b', sections: [{ id: 'bs', items: ['b1', 'b2'] }] },
            ])
            const click = () => {
              const [a, b] = groups.value
              groups.value = [
                b,
                { ...a, sections: [a.sections[1], a.sections[0]] },
              ]
            }

            onMounted(() => {
              const styleNode = document.createElement('style')
              styleNode.textContent = `
                .inner-item { height: 30px; }
                ${moveClasses} {
                  transition: transform ${duration}ms ease;
                }
              `
              document.head.appendChild(styleNode)
            })

            return { groups, click }
          },
        }).mount('#app')
      },
      { duration, moveClasses },
    )
    const { before, start } = await layoutWhenTransitionStart(
      '.outer-item, .middle-item, .inner-item',
    )
    expect(before.map(({ top }) => top)).toStrictEqual([
      0, 0, 0, 30, 60, 60, 90, 120, 120, 120, 150,
    ])
    return start
  }

  // the nearest enclosing group has no move transition, the one above it does:
  // the inner groups animate the sections' jumps but not the outer items' moves
  test(
    'nested group three levels deep with a middle group that does not move',
    async () => {
      const start = await threeLevelGroupsWhenTransitionStart(
        '.outer-move, .inner-move',
      )
      expect(start).toStrictEqual([
        { id: 'b', top: 120, classes: ['outer-item', 'outer-move'] },
        { id: 'bs', top: 120, classes: ['middle-item'] },
        { id: 'b1', top: 120, classes: ['inner-item'] },
        { id: 'b2', top: 150, classes: ['inner-item'] },
        { id: 'a', top: 0, classes: ['outer-item', 'outer-move'] },
        { id: 'as2', top: 0, classes: ['middle-item'] },
        { id: 'a3', top: 60, classes: ['inner-item', 'inner-move'] },
        { id: 'a4', top: 90, classes: ['inner-item', 'inner-move'] },
        { id: 'as1', top: 60, classes: ['middle-item'] },
        { id: 'a1', top: 0, classes: ['inner-item', 'inner-move'] },
        { id: 'a2', top: 30, classes: ['inner-item', 'inner-move'] },
      ])

      await transitionFinish()
    },
    E2E_TIMEOUT,
  )

  // coverage guard: with all three levels moving, each group leaves out what
  // its nearest moving enclosing group animates, so every item starts out where
  // it was
  test(
    'nested group three levels deep with every group moving',
    async () => {
      const start = await threeLevelGroupsWhenTransitionStart(
        '.outer-move, .middle-move, .inner-move',
      )
      expect(start).toStrictEqual([
        { id: 'b', top: 120, classes: ['outer-item', 'outer-move'] },
        { id: 'bs', top: 120, classes: ['middle-item'] },
        { id: 'b1', top: 120, classes: ['inner-item'] },
        { id: 'b2', top: 150, classes: ['inner-item'] },
        { id: 'a', top: 0, classes: ['outer-item', 'outer-move'] },
        { id: 'as2', top: 60, classes: ['middle-item', 'middle-move'] },
        { id: 'a3', top: 60, classes: ['inner-item'] },
        { id: 'a4', top: 90, classes: ['inner-item'] },
        { id: 'as1', top: 0, classes: ['middle-item', 'middle-move'] },
        { id: 'a1', top: 0, classes: ['inner-item'] },
        { id: 'a2', top: 30, classes: ['inner-item'] },
      ])

      await transitionFinish()
    },
    E2E_TIMEOUT,
  )

  // coverage guard: the outer item moves without the outer group updating, so
  // the inner group has to animate that movement itself
  test(
    'nested group updating on its own inside a moving outer item',
    async () => {
      await page().evaluate(duration => {
        const { createApp, ref, onMounted, defineComponent } = (window as any)
          .Vue
        const Inner = defineComponent({
          template: `
            <transition-group name="inner" tag="div">
              <div v-for="item in items" :key="item" :id="item" class="inner-item">{{ item }}</div>
            </transition-group>
            <button id="toggleBtn" @click="items.push('i3')">button</button>
          `,
          setup: () => ({ items: ref(['i1', 'i2']) }),
        })
        createApp({
          components: { Inner },
          template: `
            <div id="container">
              <transition-group name="outer" tag="div" class="stack">
                <div key="group" id="group" class="outer-item"><Inner /></div>
              </transition-group>
            </div>
          `,
          setup: () => {
            onMounted(() => {
              const styleNode = document.createElement('style')
              styleNode.textContent = `
                .stack { position: fixed; bottom: 0; }
                .inner-item { height: 30px; }
                .outer-move,
                .inner-move {
                  transition: transform ${duration}ms ease;
                }
              `
              document.head.appendChild(styleNode)
            })
          },
        }).mount('#app')
      }, duration)

      const { before, start } = await layoutWhenTransitionStart('.inner-item')
      expect(start.slice(0, 2)).toStrictEqual(
        before.map(item => ({
          ...item,
          classes: ['inner-item', 'inner-move'],
        })),
      )

      await transitionFinish()
    },
    E2E_TIMEOUT,
  )

  // coverage guard: positions must stay comparable when the inner group's
  // elements are teleported into or out of the outer item on the same update
  test(
    'nested group teleported across the outer item',
    async () => {
      await page().evaluate(duration => {
        const { createApp, ref, onMounted } = (window as any).Vue
        createApp({
          template: `
            <div id="target"></div>
            <div id="container">
              <transition-group name="outer" tag="div">
                <div key="group" id="group" class="outer-item">
                  <Teleport to="#target" :disabled="disabled">
                    <transition-group name="inner" tag="div">
                      <div v-for="item in items" :key="item" :id="item" class="inner-item">{{ item }}</div>
                    </transition-group>
                  </Teleport>
                </div>
              </transition-group>
            </div>
            <button id="toggleBtn" @click="click">button</button>
          `,
          setup: () => {
            const items = ref(['i1', 'i2'])
            const disabled = ref(false)
            const click = () => {
              disabled.value = !disabled.value
              items.value.reverse()
            }

            onMounted(() => {
              const styleNode = document.createElement('style')
              styleNode.textContent = `
                #target { position: fixed; top: 100px; }
                #group { position: fixed; top: 200px; }
                .inner-item { height: 30px; }
                .outer-move,
                .inner-move {
                  transition: transform ${duration}ms ease;
                }
              `
              document.head.appendChild(styleNode)
            })

            return { items, disabled, click }
          },
        }).mount('#app')
      }, duration)

      // out of the target, back into the outer item
      let { before, start } = await layoutWhenTransitionStart('.inner-item')
      expect(before.map(({ top }) => top)).toStrictEqual([100, 130])
      expect(start).toStrictEqual([
        { id: 'i2', top: 130, classes: ['inner-item', 'inner-move'] },
        { id: 'i1', top: 100, classes: ['inner-item', 'inner-move'] },
      ])
      await transitionFinish()

      // out of the outer item, into the target
      ;({ before, start } = await layoutWhenTransitionStart('.inner-item'))
      expect(before.map(({ top }) => top)).toStrictEqual([200, 230])
      expect(start).toStrictEqual([
        { id: 'i1', top: 230, classes: ['inner-item', 'inner-move'] },
        { id: 'i2', top: 200, classes: ['inner-item', 'inner-move'] },
      ])
      await transitionFinish()
    },
    E2E_TIMEOUT,
  )

  test(
    'not leaking after children unmounted',
    async () => {
      const client = await page().createCDPSession()
      await page().evaluate(async () => {
        const { createApp, ref, nextTick } = (window as any).Vue
        const show = ref(true)

        createApp({
          components: {
            Child: {
              setup: () => {
                // Big arrays kick GC earlier
                const test = ref([...Array(3000)].map((_, i) => ({ i })))
                // @ts-expect-error - Custom property and same lib as runtime is used
                window.__REF__ = new WeakRef(test)

                return { test }
              },
              template: `
              <p>{{ test.length }}</p>
            `,
            },
          },
          template: `
          <transition-group>
            <Child v-if="show" />
          </transition-group>
        `,
          setup() {
            return { show }
          },
        }).mount('#app')

        show.value = false
        await nextTick()
      })

      const isCollected = async () =>
        // @ts-expect-error - Custom property
        await page().evaluate(() => window.__REF__.deref() === undefined)

      while ((await isCollected()) === false) {
        await client.send('HeapProfiler.collectGarbage')
      }

      expect(await isCollected()).toBe(true)
    },
    E2E_TIMEOUT,
  )
})
