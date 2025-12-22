import path from 'node:path'
import {
  E2E_TIMEOUT,
  setupPuppeteer,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import connect from 'connect'
import sirv from 'sirv'
import { nextTick } from 'vue'
const {
  page,
  classList,
  timeout,
  isVisible,
  html,
  nextFrame,
  transitionStart,
  waitForInnerHTML,
  click,
} = setupPuppeteer()

const duration = process.env.CI ? 200 : 50
const buffer = process.env.CI ? 50 : 20

describe('vapor transition', () => {
  let server: any
  const port = '8195'
  beforeAll(() => {
    server = connect()
      .use(sirv(path.resolve(import.meta.dirname, '../dist')))
      .listen(port)
    process.on('SIGTERM', () => server && server.close())
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(async () => {
    const baseUrl = `http://localhost:${port}/transition/`
    await page().evaluateOnNewDocument(dur => {
      ;(window as any).__TRANSITION_DURATION__ = dur
    }, duration)
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
  })

  describe('transition with v-if', () => {
    test(
      'basic transition',
      async () => {
        const btnSelector = '.if-basic > button'
        const containerSelector = '.if-basic > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          `<div class="test">content</div>`,
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).outerHTML,
        ).toBe(`<div class="test v-leave-from v-leave-active">content</div>`)

        await waitForInnerHTML(
          containerSelector,
          `<div class="test v-leave-active v-leave-to">content</div>`,
        )

        await waitForInnerHTML(containerSelector, ``)

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).outerHTML,
        ).toBe(`<div class="test v-enter-from v-enter-active">content</div>`)

        await waitForInnerHTML(
          containerSelector,
          `<div class="test v-enter-active v-enter-to">content</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'named transition',
      async () => {
        const btnSelector = '.if-named > button'
        const containerSelector = '.if-named > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).outerHTML,
        ).toBe(
          `<div class="test test-leave-from test-leave-active">content</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )

        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).outerHTML,
        ).toBe(
          `<div class="test test-enter-from test-enter-active">content</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">content</div>',
        )

        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'custom transition classes',
      async () => {
        const btnSelector = '.if-custom-classes > button'
        const containerSelector = '.if-custom-classes > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )
        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).outerHTML,
        ).toBe(`<div class="test bye-from bye-active">content</div>`)

        await waitForInnerHTML(
          containerSelector,
          '<div class="test bye-active bye-to">content</div>',
        )

        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).outerHTML,
        ).toBe(`<div class="test hello-from hello-active">content</div>`)

        await waitForInnerHTML(
          containerSelector,
          '<div class="test hello-active hello-to">content</div>',
        )

        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'transition with dynamic name',
      async () => {
        const btnSelector = '.if-dynamic-name > button.toggle'
        const btnChangeNameSelector = '.if-dynamic-name > button.change'
        const containerSelector = '.if-dynamic-name > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).outerHTML,
        ).toBe(
          `<div class="test test-leave-from test-leave-active">content</div>`,
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await waitForInnerHTML(containerSelector, '')

        // enter
        await click(btnChangeNameSelector)
        await nextTick()
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'changed-enter-from', 'changed-enter-active'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test changed-enter-active changed-enter-to">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'transition events without appear',
      async () => {
        const btnSelector = '.if-events-without-appear > button'
        const containerSelector = '.if-events-without-appear > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )
        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])

        let calls = await page().evaluate(() => {
          return (window as any).getCalls('withoutAppear')
        })
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )

        expect(
          await page().evaluate(() => {
            return (window as any).getCalls('withoutAppear')
          }),
        ).not.contain('afterLeave')
        await waitForInnerHTML(containerSelector, '')

        expect(
          await page().evaluate(() => {
            return (window as any).getCalls('withoutAppear')
          }),
        ).toStrictEqual(['beforeLeave', 'onLeave', 'afterLeave'])

        await page().evaluate(() => {
          ;(window as any).resetCalls('withoutAppear')
        })

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])

        calls = await page().evaluate(() => {
          return (window as any).getCalls('withoutAppear')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">content</div>',
        )
        expect(
          await page().evaluate(() => {
            return (window as any).getCalls('withoutAppear')
          }),
        ).not.contain('afterEnter')

        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
        expect(
          await page().evaluate(() => {
            return (window as any).getCalls('withoutAppear')
          }),
        ).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])
      },
      E2E_TIMEOUT,
    )

    test(
      'events with arguments',
      async () => {
        const btnSelector = '.if-events-with-args > button'
        const containerSelector = '.if-events-with-args > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        await click(btnSelector)
        let calls = await page().evaluate(() => {
          return (window as any).getCalls('withArgs')
        })
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave'])
        expect(await classList(childSelector)).toStrictEqual([
          'test',
          'before-leave',
          'leave',
        ])

        await timeout(200 + buffer)
        calls = await page().evaluate(() => {
          return (window as any).getCalls('withArgs')
        })
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave', 'afterLeave'])
        expect(await html(containerSelector)).toBe('')

        await page().evaluate(() => {
          ;(window as any).resetCalls('withArgs')
        })

        // enter
        await click(btnSelector)
        calls = await page().evaluate(() => {
          return (window as any).getCalls('withArgs')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])
        expect(await classList(childSelector)).toStrictEqual([
          'test',
          'before-enter',
          'enter',
        ])

        await timeout(200 + buffer)
        calls = await page().evaluate(() => {
          return (window as any).getCalls('withArgs')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])
        expect(await html(containerSelector)).toBe(
          '<div class="test before-enter enter after-enter">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'onEnterCancelled',
      async () => {
        const btnSelector = '.if-enter-cancelled > button'
        const containerSelector = '.if-enter-cancelled > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe('')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">content</div>',
        )

        // cancel (leave)
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        let calls = await page().evaluate(() => {
          return (window as any).getCalls('enterCancel')
        })
        expect(calls).toStrictEqual(['enterCancelled'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await waitForInnerHTML(containerSelector, '')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition on appear',
      async () => {
        const btnSelector = '.if-appear > button'
        const containerSelector = '.if-appear > div'
        const childSelector = `${containerSelector} > div`

        // appear
        expect(await classList(childSelector)).contains('test-appear-active')
        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'transition events with appear',
      async () => {
        const btnSelector = '.if-events-with-appear > button'
        const containerSelector = '.if-events-with-appear > div'
        const childSelector = `${containerSelector} > div`
        // appear
        expect(await classList(childSelector)).contains('test-appear-active')
        let calls = await page().evaluate(() => {
          return (window as any).getCalls('withAppear')
        })
        expect(calls).toStrictEqual(['beforeAppear', 'onAppear'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
        calls = await page().evaluate(() => {
          return (window as any).getCalls('withAppear')
        })
        expect(calls).toStrictEqual(['beforeAppear', 'onAppear', 'afterAppear'])

        await page().evaluate(() => {
          ;(window as any).resetCalls('withAppear')
        })

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])

        calls = await page().evaluate(() => {
          return (window as any).getCalls('withAppear')
        })
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        calls = await page().evaluate(() => {
          return (window as any).getCalls('withAppear')
        })
        expect(calls).not.contain('afterLeave')

        await waitForInnerHTML(containerSelector, '')
        calls = await page().evaluate(() => {
          return (window as any).getCalls('withAppear')
        })
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave', 'afterLeave'])

        await page().evaluate(() => {
          ;(window as any).resetCalls('withAppear')
        })

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        calls = await page().evaluate(() => {
          return (window as any).getCalls('withAppear')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">content</div>',
        )
        calls = await page().evaluate(() => {
          return (window as any).getCalls('withAppear')
        })
        expect(calls).not.contain('afterEnter')
        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
        calls = await page().evaluate(() => {
          return (window as any).getCalls('withAppear')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])
      },
      E2E_TIMEOUT,
    )
    test(
      'css: false',
      async () => {
        const btnSelector = '.if-css-false > button'
        const containerSelector = '.if-css-false > div'
        const childSelector = `${containerSelector} > div`
        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        await click(btnSelector)
        let calls = await page().evaluate(() => {
          return (window as any).getCalls('cssFalse')
        })
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave', 'afterLeave'])
        expect(await html(containerSelector)).toBe('')

        await page().evaluate(() => {
          ;(window as any).resetCalls('cssFalse')
        })

        // enter
        await transitionStart(btnSelector, childSelector)
        calls = await page().evaluate(() => {
          return (window as any).getCalls('cssFalse')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])
        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'no transition detected',
      async () => {
        const btnSelector = '.if-no-trans > button'
        const containerSelector = '.if-no-trans > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe('<div>content</div>')
        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['noop-leave-from', 'noop-leave-active'])

        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['noop-enter-from', 'noop-enter-active'])

        await waitForInnerHTML(containerSelector, '<div class="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'animations',
      async () => {
        const btnSelector = '.if-ani > button'
        const containerSelector = '.if-ani > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe('<div>content</div>')

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test-anim-leave-from', 'test-anim-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test-anim-leave-active test-anim-leave-to">content</div>',
        )
        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test-anim-enter-from', 'test-anim-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test-anim-enter-active test-anim-enter-to">content</div>',
        )
        await waitForInnerHTML(containerSelector, '<div class="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'explicit transition type',
      async () => {
        const btnSelector = '.if-ani-explicit-type > button'
        const containerSelector = '.if-ani-explicit-type > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe('<div>content</div>')

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual([
          'test-anim-long-leave-from',
          'test-anim-long-leave-active',
        ])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test-anim-long-leave-active test-anim-long-leave-to">content</div>',
        )

        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual([
          'test-anim-long-enter-from',
          'test-anim-long-enter-active',
        ])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test-anim-long-enter-active test-anim-long-enter-to">content</div>',
        )

        await waitForInnerHTML(containerSelector, '<div class="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test.todo('transition on SVG elements', async () => {}, E2E_TIMEOUT)

    test(
      'custom transition higher-order component',
      async () => {
        const btnSelector = '.if-high-order > button'
        const containerSelector = '.if-high-order > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'transition on child components with empty root node',
      async () => {
        const btnSelector = '.if-empty-root > button.toggle'
        const btnChangeSelector = '.if-empty-root > button.change'
        const containerSelector = '.if-empty-root > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe('')

        // change view -> 'two'
        await click(btnChangeSelector)

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">two</div>',
        )
        await waitForInnerHTML(containerSelector, '<div class="test">two</div>')

        // change view -> 'one'
        await click(btnChangeSelector)

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">two</div>',
        )
        await waitForInnerHTML(containerSelector, '')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition with v-if at component root-level',
      async () => {
        const btnSelector = '.if-at-component-root-level > button.toggle'
        const btnChangeSelector = '.if-at-component-root-level > button.change'
        const containerSelector = '.if-at-component-root-level > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe('')

        // change view -> 'two'
        await click(btnChangeSelector)
        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">two</div>',
        )
        await waitForInnerHTML(containerSelector, '<div class="test">two</div>')

        // change view -> 'one'
        await click(btnChangeSelector)
        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">two</div>',
        )
        await waitForInnerHTML(containerSelector, '')
      },
      E2E_TIMEOUT,
    )

    test(
      'wrapping transition + fallthrough attrs',
      async () => {
        const btnSelector = '.if-fallthrough-attr > button'
        const containerSelector = '.if-fallthrough-attr > div'

        expect(await html(containerSelector)).toBe('<div foo="1">content</div>')

        await click(btnSelector)
        // toggle again before leave finishes
        await nextTick()
        await click(btnSelector)

        await waitForInnerHTML(
          containerSelector,
          '<div foo="1" class="">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'transition + fallthrough attrs (in-out mode)',
      async () => {
        const btnSelector = '.if-fallthrough-attr-in-out > button'
        const containerSelector = '.if-fallthrough-attr-in-out > div'

        expect(await html(containerSelector)).toBe('<div foo="1">one</div>')

        // toggle
        await click(btnSelector)
        await nextTick()
        await waitForInnerHTML(
          containerSelector,
          '<div foo="1" class="">two</div>',
        )
        let calls = await page().evaluate(() => {
          return (window as any).getCalls('ifInOut')
        })
        expect(calls).toStrictEqual([
          'beforeEnter',
          'onEnter',
          'afterEnter',
          'beforeLeave',
          'onLeave',
          'afterLeave',
        ])

        expect(await html(containerSelector)).toBe(
          '<div foo="1" class="">two</div>',
        )

        // clear calls
        await page().evaluate(() => {
          ;(window as any).resetCalls('ifInOut')
        })

        // toggle back
        await click(btnSelector)
        await nextTick()
        await waitForInnerHTML(
          containerSelector,
          '<div foo="1" class="">one</div>',
        )

        calls = await page().evaluate(() => {
          return (window as any).getCalls('ifInOut')
        })
        expect(calls).toStrictEqual([
          'beforeEnter',
          'onEnter',
          'afterEnter',
          'beforeLeave',
          'onLeave',
          'afterLeave',
        ])

        expect(await html(containerSelector)).toBe(
          '<div foo="1" class="">one</div>',
        )
      },
      E2E_TIMEOUT,
    )
  })

  describe('transition with KeepAlive', () => {
    test('unmount innerChild (out-in mode)', async () => {
      const btnSelector = '.keep-alive > button'
      const containerSelector = '.keep-alive > div'

      await waitForInnerHTML(containerSelector, '<div>0</div>')

      await click(btnSelector)

      await waitForInnerHTML(containerSelector, '')
      const calls = await page().evaluate(() => {
        return (window as any).getCalls('unmount')
      })
      expect(calls).toStrictEqual(['TrueBranch'])
    })

    // #11775
    test(
      'switch child then update include (out-in mode)',
      async () => {
        const containerSelector = '.keep-alive-update-include > div'
        const btnSwitchToB = '.keep-alive-update-include > #switchToB'
        const btnSwitchToA = '.keep-alive-update-include > #switchToA'
        const btnSwitchToC = '.keep-alive-update-include > #switchToC'

        expect(await html(containerSelector)).toBe('<div>CompA</div>')

        await click(btnSwitchToB)
        await nextTick()
        await click(btnSwitchToC)
        await waitForInnerHTML(containerSelector, '<div class="">CompC</div>')

        await click(btnSwitchToA)
        await waitForInnerHTML(containerSelector, '<div class="">CompA</div>')

        let calls = await page().evaluate(() => {
          return (window as any).getCalls('unmount')
        })
        expect(calls).toStrictEqual(['CompC unmounted'])

        // Unlike vdom, CompA does not update because there are no state changes
        // expect CompA only update once
        // calls = await page().evaluate(() => {
        //   return (window as any).getCalls('updated')
        // })
        // expect(calls).toStrictEqual(['CompA updated'])
      },
      E2E_TIMEOUT,
    )

    // #10827
    test(
      'switch and update child then update include (out-in mode)',
      async () => {
        const containerSelector = '.keep-alive-switch-then-update-include > div'
        const btnSwitchToA =
          '.keep-alive-switch-then-update-include > #switchToA'
        const btnSwitchToB =
          '.keep-alive-switch-then-update-include > #switchToB'

        expect(await html(containerSelector)).toBe('<div>CompA2</div>')
        await click(btnSwitchToB)
        await waitForInnerHTML(containerSelector, '<div class="">CompB2</div>')
        await click(btnSwitchToA)
        await waitForInnerHTML(containerSelector, '<div class="">CompA2</div>')
        let calls = await page().evaluate(() => {
          return (window as any).getCalls('unmount')
        })
        expect(calls).toStrictEqual(['CompB2 unmounted'])
      },
      E2E_TIMEOUT,
    )

    // #12860
    test.todo(
      'unmount children',
      async () => {
        //     const unmountSpy = vi.fn()
        //     let storageContainer: ElementHandle<HTMLDivElement>
        //     const setStorageContainer = (container: any) =>
        //       (storageContainer = container)
        //     await page().exposeFunction('unmountSpy', unmountSpy)
        //     await page().exposeFunction('setStorageContainer', setStorageContainer)
        //     await page().evaluate(() => {
        //       const { unmountSpy, setStorageContainer } = window as any
        //       const { createApp, ref, h, onUnmounted, getCurrentInstance } = (
        //         window as any
        //       ).Vue
        //       createApp({
        //         template: `
        //         <div id="container">
        //           <transition>
        //             <KeepAlive :include="includeRef">
        //               <TrueBranch v-if="toggle"></TrueBranch>
        //             </KeepAlive>
        //           </transition>
        //         </div>
        //         <button id="toggleBtn" @click="click">button</button>
        //       `,
        //         components: {
        //           TrueBranch: {
        //             name: 'TrueBranch',
        //             setup() {
        //               const instance = getCurrentInstance()
        //               onUnmounted(() => {
        //                 unmountSpy()
        //                 setStorageContainer(instance.__keepAliveStorageContainer)
        //               })
        //               const count = ref(0)
        //               return () => h('div', count.value)
        //             },
        //           },
        //         },
        //         setup: () => {
        //           const includeRef = ref(['TrueBranch'])
        //           const toggle = ref(true)
        //           const click = () => {
        //             toggle.value = !toggle.value
        //             if (toggle.value) {
        //               includeRef.value = ['TrueBranch']
        //             } else {
        //               includeRef.value = []
        //             }
        //           }
        //           return { toggle, click, unmountSpy, includeRef }
        //         },
        //       }).mount('#app')
        //     })
        //     await transitionFinish()
        //     expect(await html('#container')).toBe('<div>0</div>')
        //     await click('#toggleBtn')
        //     await transitionFinish()
        //     expect(await html('#container')).toBe('<!--v-if-->')
        //     expect(unmountSpy).toBeCalledTimes(1)
        //     expect(await storageContainer!.evaluate(x => x.innerHTML)).toBe(``)
      },
      E2E_TIMEOUT,
    )

    // #13153
    test(
      'move kept-alive node before v-show transition leave finishes',
      async () => {
        const containerSelector = '.keep-alive-move-before-leave-finishes > div'
        const btnToggle = '.keep-alive-move-before-leave-finishes > button'
        const changeShowBtn = `${containerSelector} #changeShowBtn`

        expect(await html(containerSelector)).toBe(
          `<div><h2>I should show</h2></div>` +
            `<h2>This is page1</h2>` +
            `<button id="changeShowBtn">true</button>`,
        )
        // trigger v-show transition leave
        await click(changeShowBtn)
        await waitForInnerHTML(
          containerSelector,
          `<div class="test-leave-from test-leave-active"><h2>I shouldn't show </h2></div>` +
            `<h2>This is page1</h2>` +
            `<button id="changeShowBtn">false</button>`,
        )

        // switch to page2, before leave finishes
        // expect v-show element's display to be none
        await click(btnToggle)
        await nextTick()
        // different from vdom behavior, the leaving element is removed immediately
        // vdom's behavior is hidden but still in DOM until leave transition finishes
        await waitForInnerHTML(containerSelector, `<h2>This is page2</h2>`)

        // switch back to page1
        // expect v-show element's display to be none
        await click(btnToggle)
        await nextTick()
        await waitForInnerHTML(
          containerSelector,
          `<div class="" style="display: none;"><h2>I shouldn't show </h2></div>` +
            `<h2>This is page1</h2>` +
            `<button id="changeShowBtn">false</button>`,
        )
      },
      E2E_TIMEOUT,
    )
  })

  describe.todo('transition with Suspense', () => {})

  describe('transition with Teleport', () => {
    test(
      'apply transition to teleport child',
      async () => {
        const btnSelector = '.with-teleport > button'
        const containerSelector = '.with-teleport > .container'
        const targetSelector = `.with-teleport > .target`

        await waitForInnerHTML(containerSelector, '')
        await waitForInnerHTML(targetSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, `${targetSelector} div`))
            .classNames,
        ).toStrictEqual(['test', 'v-enter-from', 'v-enter-active'])
        await waitForInnerHTML(
          targetSelector,
          '<div class="test v-enter-active v-enter-to">vapor compB</div>',
        )
        await waitForInnerHTML(
          targetSelector,
          '<div class="test">vapor compB</div>',
        )
        expect(await html(containerSelector)).toBe('')

        // leave
        expect(
          (await transitionStart(btnSelector, `${targetSelector} div`))
            .classNames,
        ).toStrictEqual(['test', 'v-leave-from', 'v-leave-active'])
        await waitForInnerHTML(
          targetSelector,
          '<div class="test v-leave-active v-leave-to">vapor compB</div>',
        )
        await waitForInnerHTML(targetSelector, '')
        expect(await html(containerSelector)).toBe('')
      },
      E2E_TIMEOUT,
    )
  })

  describe('transition with AsyncComponent', () => {
    test('apply transition to inner component', async () => {
      const btnSelector = '.async > button'
      const containerSelector = '.async > div'

      expect(await html(containerSelector)).toBe('')

      // toggle
      await click(btnSelector)
      await nextTick()
      // not yet resolved
      expect(await html(containerSelector)).toBe('')

      // wait resolving
      await timeout(50)

      // enter (resolved)
      expect(await html(containerSelector)).toBe(
        '<div class="v-enter-from v-enter-active">vapor compA</div>',
      )
      await waitForInnerHTML(
        containerSelector,
        '<div class="v-enter-active v-enter-to">vapor compA</div>',
      )
      await waitForInnerHTML(
        containerSelector,
        '<div class="">vapor compA</div>',
      )

      // leave
      await click(btnSelector)
      await nextTick()
      expect(await html(containerSelector)).toBe(
        '<div class="v-leave-from v-leave-active">vapor compA</div>',
      )
      await waitForInnerHTML(
        containerSelector,
        '<div class="v-leave-active v-leave-to">vapor compA</div>',
      )
      await waitForInnerHTML(containerSelector, '')

      // enter again
      await click(btnSelector)
      // use the already resolved component
      expect(await html(containerSelector)).toBe(
        '<div class="v-enter-from v-enter-active">vapor compA</div>',
      )
      await waitForInnerHTML(
        containerSelector,
        '<div class="v-enter-active v-enter-to">vapor compA</div>',
      )
      await waitForInnerHTML(
        containerSelector,
        '<div class="">vapor compA</div>',
      )
    })
  })

  describe('transition with v-show', () => {
    test(
      'named transition with v-show',
      async () => {
        const btnSelector = '.show-named > button'
        const containerSelector = '.show-named > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )
        expect(await isVisible(childSelector)).toBe(true)

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test" style="display: none;">content</div>',
        )

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to" style="">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test" style="">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'transition events with v-show',
      async () => {
        const btnSelector = '.show-events > button'
        const containerSelector = '.show-events > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )

        let calls = await page().evaluate(() => {
          return (window as any).getCalls('show')
        })
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave'])
        calls = await page().evaluate(() => {
          return (window as any).getCalls('show')
        })
        expect(calls).not.contain('afterLeave')
        await waitForInnerHTML(
          containerSelector,
          '<div class="test" style="display: none;">content</div>',
        )
        calls = await page().evaluate(() => {
          return (window as any).getCalls('show')
        })
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave', 'afterLeave'])

        // clear calls
        await page().evaluate(() => {
          ;(window as any).resetCalls('show')
        })

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to" style="">content</div>',
        )
        calls = await page().evaluate(() => {
          return (window as any).getCalls('show')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test" style="">content</div>',
        )
        calls = await page().evaluate(() => {
          return (window as any).getCalls('show')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])
      },
      E2E_TIMEOUT,
    )

    test(
      'onLeaveCancelled (v-show only)',
      async () => {
        const btnSelector = '.show-leave-cancelled > button'
        const containerSelector = '.show-leave-cancelled > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )

        // cancel (enter)
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        let calls = await page().evaluate(() => {
          return (window as any).getCalls('showLeaveCancel')
        })
        expect(calls).toStrictEqual(['leaveCancelled'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to" style="">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test" style="">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'transition on appear with v-show',
      async () => {
        const btnSelector = '.show-appear > button'
        const containerSelector = '.show-appear > div'
        const childSelector = `${containerSelector} > div`

        let calls = await page().evaluate(() => {
          return (window as any).getCalls('showAppear')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])

        // appear
        expect(await classList(childSelector)).contains('test-appear-active')

        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
        calls = await page().evaluate(() => {
          return (window as any).getCalls('showAppear')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test" style="display: none;">content</div>',
        )

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to" style="">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test" style="">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'transition events should not call onEnter with v-show false',
      async () => {
        const btnSelector = '.show-appear-not-enter > button'
        const containerSelector = '.show-appear-not-enter > div'
        const childSelector = `${containerSelector} > div`

        expect(await isVisible(childSelector)).toBe(false)
        let calls = await page().evaluate(() => {
          return (window as any).getCalls('notEnter')
        })
        expect(calls).toStrictEqual([])

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        calls = await page().evaluate(() => {
          return (window as any).getCalls('notEnter')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])

        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to" style="">content</div>',
        )
        calls = await page().evaluate(() => {
          return (window as any).getCalls('notEnter')
        })
        expect(calls).not.contain('afterEnter')
        await waitForInnerHTML(
          containerSelector,
          '<div class="test" style="">content</div>',
        )
        calls = await page().evaluate(() => {
          return (window as any).getCalls('notEnter')
        })
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])
      },
      E2E_TIMEOUT,
    )
  })

  describe('explicit durations', () => {
    test(
      'single value',
      async () => {
        const btnSelector = '.duration-single-value > button'
        const containerSelector = '.duration-single-value > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'enter with explicit durations',
      async () => {
        const btnSelector = '.duration-enter > button'
        const containerSelector = '.duration-enter > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'leave with explicit durations',
      async () => {
        const btnSelector = '.duration-leave > button'
        const containerSelector = '.duration-leave > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'separate enter and leave',
      async () => {
        const btnSelector = '.duration-enter-leave > button'
        const containerSelector = '.duration-enter-leave > div'
        const childSelector = `${containerSelector} > div`

        expect(await html(containerSelector)).toBe(
          '<div class="test">content</div>',
        )

        // leave
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-leave-from', 'test-leave-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await waitForInnerHTML(containerSelector, '')

        // enter
        expect(
          (await transitionStart(btnSelector, childSelector)).classNames,
        ).toStrictEqual(['test', 'test-enter-from', 'test-enter-active'])
        await waitForInnerHTML(
          containerSelector,
          '<div class="test test-enter-active test-enter-to">content</div>',
        )
        await waitForInnerHTML(
          containerSelector,
          '<div class="test">content</div>',
        )
      },
      E2E_TIMEOUT,
    )
  })

  test(
    'should work with keyed element',
    async () => {
      const btnSelector = '.keyed > button'
      const containerSelector = '.keyed > h1'

      await waitForInnerHTML(containerSelector, '0')

      // change key
      expect(
        (await transitionStart(btnSelector, containerSelector)).classNames,
      ).toStrictEqual(['v-leave-from', 'v-leave-active'])

      await nextFrame()
      expect(await classList(containerSelector)).toStrictEqual([
        'v-leave-active',
        'v-leave-to',
      ])
      await waitForInnerHTML(containerSelector, '1')

      // change key again
      expect(
        (await transitionStart(btnSelector, containerSelector)).classNames,
      ).toStrictEqual(['v-leave-from', 'v-leave-active'])

      await nextFrame()
      expect(await classList(containerSelector)).toStrictEqual([
        'v-leave-active',
        'v-leave-to',
      ])

      await waitForInnerHTML(containerSelector, '2')
    },
    E2E_TIMEOUT,
  )

  test(
    'should work with out-in mode',
    async () => {
      const btnSelector = '.out-in > button'
      const containerSelector = '.out-in > div'

      expect(await html(containerSelector)).toBe(`<div>vapor compB</div>`)

      // compB -> compA
      // compB leave
      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(`<div class="fade-leave-from fade-leave-active">vapor compB</div>`)

      await waitForInnerHTML(
        containerSelector,
        `<div class="fade-leave-active fade-leave-to">vapor compB</div>`,
      )

      // compA enter
      await waitForInnerHTML(
        containerSelector,
        `<div class="fade-enter-from fade-enter-active">vapor compA</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="fade-enter-active fade-enter-to">vapor compA</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="">vapor compA</div>`,
      )

      // compA -> compB
      // compA leave
      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(`<div class="fade-leave-from fade-leave-active">vapor compA</div>`)

      await waitForInnerHTML(
        containerSelector,
        `<div class="fade-leave-active fade-leave-to">vapor compA</div>`,
      )

      // compB enter
      await waitForInnerHTML(
        containerSelector,
        `<div class="fade-enter-from fade-enter-active">vapor compB</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="fade-enter-active fade-enter-to">vapor compB</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="">vapor compB</div>`,
      )
    },
    E2E_TIMEOUT,
  )

  test(
    'should work with in-out mode',
    async () => {
      const btnSelector = '.in-out > button'
      const containerSelector = '.in-out > div'

      expect(await html(containerSelector)).toBe(`<div>vapor compB</div>`)

      // compA enter
      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div>vapor compB</div><div class="fade-enter-from fade-enter-active">vapor compA</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div>vapor compB</div><div class="fade-enter-active fade-enter-to">vapor compA</div>`,
      )

      // compB leave
      await waitForInnerHTML(
        containerSelector,
        `<div class="fade-leave-from fade-leave-active">vapor compB</div><div class="">vapor compA</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="fade-leave-active fade-leave-to">vapor compB</div><div class="">vapor compA</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="">vapor compA</div>`,
      )
    },
    E2E_TIMEOUT,
  )

  // tests for using vdom component in createVaporApp + vaporInteropPlugin
  describe('interop', () => {
    test(
      'render vdom component',
      async () => {
        const btnSelector = '.vdom > button'
        const containerSelector = '.vdom > div'

        expect(await html(containerSelector)).toBe(`<div>vdom comp</div>`)

        // comp leave
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(`<div class="v-leave-from v-leave-active">vdom comp</div>`)

        await waitForInnerHTML(
          containerSelector,
          `<div class="v-leave-active v-leave-to">vdom comp</div>`,
        )

        await waitForInnerHTML(containerSelector, ``)

        // comp enter
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(`<div class="v-enter-from v-enter-active">vdom comp</div>`)

        await waitForInnerHTML(
          containerSelector,
          `<div class="v-enter-active v-enter-to">vdom comp</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="">vdom comp</div>`,
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'switch between vdom/vapor component (out-in mode)',
      async () => {
        const btnSelector = '.vdom-vapor-out-in > button'
        const containerSelector = '.vdom-vapor-out-in > div'

        expect(await html(containerSelector)).toBe(`<div>vdom comp</div>`)

        // switch to vapor comp
        // vdom comp leave
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(`<div class="fade-leave-from fade-leave-active">vdom comp</div>`)

        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-active fade-leave-to">vdom comp</div>`,
        )

        // vapor comp enter
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-from fade-enter-active">vapor compA</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-active fade-enter-to">vapor compA</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="">vapor compA</div>`,
        )

        // switch to vdom comp
        // vapor comp leave
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(
          `<div class="fade-leave-from fade-leave-active">vapor compA</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-active fade-leave-to">vapor compA</div>`,
        )

        // vdom comp enter
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-from fade-enter-active">vdom comp</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-active fade-enter-to">vdom comp</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="">vdom comp</div>`,
        )
      },
      E2E_TIMEOUT,
    )

    test(
      'switch between vdom/vapor component (in-out mode)',
      async () => {
        const btnSelector = '.vdom-vapor-in-out > button'
        const containerSelector = '.vdom-vapor-in-out > div'

        expect(await html(containerSelector)).toBe(`<div>vapor compA</div>`)

        // switch to vdom comp
        // vdom comp enter
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(
          `<div>vapor compA</div><div class="fade-enter-from fade-enter-active">vdom comp</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div>vapor compA</div><div class="fade-enter-active fade-enter-to">vdom comp</div>`,
        )

        // vapor comp leave
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-from fade-leave-active">vapor compA</div><div class="">vdom comp</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-active fade-leave-to">vapor compA</div><div class="">vdom comp</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="">vdom comp</div>`,
        )

        // switch to vapor comp
        // vapor comp enter
        expect(
          (await transitionStart(btnSelector, containerSelector)).innerHTML,
        ).toBe(
          `<div class="">vdom comp</div><div class="fade-enter-from fade-enter-active">vapor compA</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="">vdom comp</div><div class="fade-enter-active fade-enter-to">vapor compA</div>`,
        )

        // vdom comp leave
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-from fade-leave-active">vdom comp</div><div class="">vapor compA</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-active fade-leave-to">vdom comp</div><div class="">vapor compA</div>`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="">vapor compA</div>`,
        )
      },
      E2E_TIMEOUT,
    )
  })
})
