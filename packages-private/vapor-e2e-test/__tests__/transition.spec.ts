import { createVaporApp, nextTick, vaporInteropPlugin } from 'vue'
import App from '../transition/App.vue'
import '../../../packages/vue/__tests__/e2e/style.css'
import '../transition/style.css'
import {
  E2E_TIMEOUT,
  click,
  css,
  html,
  nextFrame,
  timeout,
  transitionFinish,
  waitForInnerHTML,
} from './e2eUtils'

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveCaseId(testName: string) {
  const parts = testName
    .split(' > ')
    .map(item => item.trim())
    .filter(Boolean)
  const testTitle = parts[parts.length - 1]
  if (!testTitle) {
    throw new Error(`[transition] Invalid test name: "${testName}"`)
  }
  const suiteParts = parts.slice(1, -1)
  const folderParts = suiteParts.length ? suiteParts : [parts[0]]
  const folderPath = folderParts.map(toSlug).join('/')
  return `${folderPath}/${toSlug(testTitle)}`
}

let app: ReturnType<typeof createVaporApp>
beforeEach(() => {
  const testName = expect.getState().currentTestName || ''
  const caseId = resolveCaseId(testName)
  app = createVaporApp(App, { caseId }).use(vaporInteropPlugin)
  app.mount('#app')
})

afterEach(() => {
  app.unmount()
})

describe('vapor transition', () => {
  describe('transition with v-if', () => {
    test(
      'basic transition',
      async () => {
        const btnSelector = '.if-basic > button'
        const containerSelector = '.if-basic > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="test">content</div>`)

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test v-leave-from v-leave-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test v-leave-active v-leave-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML(`<!--if-->`)

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test v-enter-from v-enter-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test v-enter-active v-enter-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="test">content</div>`)
      },
      E2E_TIMEOUT,
    )

    test(
      'if/else-if/else chain transition',
      async () => {
        const btnSelector = '.if-else-chain > button'
        const containerSelector = '.if-else-chain > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">0</div>')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            `<div class="test v-leave-from v-leave-active">0</div>`,
          )

        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">1</div>')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            `<div class="test v-leave-from v-leave-active">1</div>`,
          )

        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">2</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'if/else-if/else chain transition (out-in mode)',
      async () => {
        const btnSelector = '.if-else-chain-out-in > button'
        const containerSelector = '.if-else-chain-out-in > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">0</div>')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test v-leave-from v-leave-active">0</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test v-leave-active v-leave-to">0</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="test v-enter-from v-enter-active">1</div><!--if--><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="test v-enter-active v-enter-to">1</div><!--if--><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">1</div>')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test v-leave-from v-leave-active">1</div><!--if--><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test v-leave-active v-leave-to">1</div><!--if--><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="test v-enter-from v-enter-active">2</div><!--if--><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="test v-enter-active v-enter-to">2</div><!--if--><!--if-->`,
        )
        await waitForInnerHTML(containerSelector, '<div class="test">2</div>')
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">2</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'named transition',
      async () => {
        const btnSelector = '.if-named > button'
        const containerSelector = '.if-named > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-from test-leave-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-active test-leave-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-from test-enter-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-active test-enter-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'custom transition classes',
      async () => {
        const btnSelector = '.if-custom-classes > button'
        const containerSelector = '.if-custom-classes > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test bye-from bye-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test bye-active bye-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test hello-from hello-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test hello-active hello-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition with dynamic name',
      async () => {
        const btnSelector = '.if-dynamic-name > button.toggle'
        const btnChangeNameSelector = '.if-dynamic-name > button.change'
        const containerSelector = '.if-dynamic-name > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-from test-leave-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-active test-leave-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        await css(btnChangeNameSelector).click()
        await expect
          .element(css(btnChangeNameSelector))
          .toHaveTextContent('changed')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test changed-enter-from changed-enter-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test changed-enter-active changed-enter-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition events without appear',
      async () => {
        const btnSelector = '.if-events-without-appear > button'
        const containerSelector = '.if-events-without-appear > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-from test-leave-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-active test-leave-to">content</div><!--if-->`,
        )

        let calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave'])

        expect((window as any).getCalls()).not.contain('afterLeave')
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')
        expect((window as any).getCalls()).toStrictEqual([
          'beforeLeave',
          'onLeave',
          'afterLeave',
        ])

        ;(window as any).resetCalls()

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-from test-enter-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-active test-enter-to">content</div><!--if-->`,
        )

        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])

        expect((window as any).getCalls()).not.contain('afterEnter')
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
        expect((window as any).getCalls()).toStrictEqual([
          'beforeEnter',
          'onEnter',
          'afterEnter',
        ])
      },
      E2E_TIMEOUT,
    )

    test(
      'events with arguments',
      async () => {
        const btnSelector = '.if-events-with-args > button'
        const containerSelector = '.if-events-with-args > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        await css(btnSelector).click()
        let calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave'])
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test before-leave leave">content</div>')

        await transitionFinish(200)
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave', 'afterLeave'])
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        ;(window as any).resetCalls()

        // enter
        await css(btnSelector).click()
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            '<div class="test before-enter enter">content</div><!--if-->',
          )

        await transitionFinish(200)
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])
        await expect
          .element(css(containerSelector))
          .toContainHTML(
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

        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-from test-enter-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-active test-enter-to">content</div><!--if-->`,
        )

        // cancel (leave)
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-from test-leave-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-active test-leave-to">content</div><!--if-->`,
        )
        const calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['enterCancelled'])

        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')
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
        await expect
          .element(css(childSelector))
          .toHaveClass('test-appear-active')
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-from test-leave-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-active test-leave-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-from test-enter-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-active test-enter-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
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
        await expect
          .element(css(childSelector))
          .toHaveClass('test-appear-active')
        let calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeAppear', 'onAppear'])

        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeAppear', 'onAppear', 'afterAppear'])

        ;(window as any).resetCalls()

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-from test-leave-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-active test-leave-to">content</div><!--if-->`,
        )

        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave'])

        calls = (window as any).getCalls()
        expect(calls).not.toContain('afterLeave')

        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave', 'afterLeave'])

        ;(window as any).resetCalls()

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-from test-enter-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-active test-enter-to">content</div><!--if-->`,
        )
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])

        calls = (window as any).getCalls()
        expect(calls).not.toContain('afterEnter')
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])
      },
      E2E_TIMEOUT,
    )
    test(
      'css: false',
      async () => {
        const btnSelector = '.if-css-false > button'
        const containerSelector = '.if-css-false > div'
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        await css(btnSelector).click()
        let calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave', 'afterLeave'])
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        ;(window as any).resetCalls()

        // enter
        await css(btnSelector).click()
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'no transition detected',
      async () => {
        const btnSelector = '.if-no-trans > button'
        const containerSelector = '.if-no-trans > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div>content</div>')
        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="noop-leave-from noop-leave-active">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="noop-enter-from noop-enter-active">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'animations',
      async () => {
        const btnSelector = '.if-ani > button'
        const containerSelector = '.if-ani > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div>content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-anim-leave-from test-anim-leave-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-anim-leave-active test-anim-leave-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-anim-enter-from test-anim-enter-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-anim-enter-active test-anim-enter-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'explicit transition type',
      async () => {
        const btnSelector = '.if-ani-explicit-type > button'
        const containerSelector = '.if-ani-explicit-type > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div>content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-anim-long-leave-from test-anim-long-leave-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-anim-long-leave-active test-anim-long-leave-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-anim-long-enter-from test-anim-long-enter-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-anim-long-enter-active test-anim-long-enter-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition on SVG elements',
      async () => {
        const btnSelector = '.svg > button'
        const containerSelector = '.svg > #container'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<circle cx="0" cy="0" r="10" class="test"></circle>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<circle cx="0" cy="0" r="10" class="test test-leave-from test-leave-active"></circle><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<circle cx="0" cy="0" r="10" class="test test-leave-active test-leave-to"></circle><!--if-->',
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<circle cx="0" cy="0" r="10" class="test test-enter-from test-enter-active"></circle><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<circle cx="0" cy="0" r="10" class="test test-enter-active test-enter-to"></circle><!--if-->',
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<circle cx="0" cy="0" r="10" class="test"></circle>')
      },
      E2E_TIMEOUT,
    )

    test(
      'custom transition higher-order component',
      async () => {
        const btnSelector = '.if-high-order > button'
        const containerSelector = '.if-high-order > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-from test-leave-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-active test-leave-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-from test-enter-active">content</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-active test-enter-to">content</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition on child components with empty root node',
      async () => {
        const btnChangeSelector = '.if-empty-root > button.change'
        const containerSelector = '.if-empty-root > div'

        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // change view -> 'two'
        // enter
        click(btnChangeSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-from test-enter-active">two</div><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-active test-enter-to">two</div><!--dynamic-component-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">two</div>')

        // change view -> 'one'
        // leave
        click(btnChangeSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-from test-leave-active">two</div><!--if--><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-active test-leave-to">two</div><!--if--><!--dynamic-component-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<!--if--><!--dynamic-component-->')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition with v-if at component root-level',
      async () => {
        const btnChangeSelector = '.if-at-component-root-level > button.change'
        const containerSelector = '.if-at-component-root-level > div'

        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // change view -> 'two'
        // enter
        click(btnChangeSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-from test-enter-active">two</div><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-enter-active test-enter-to">two</div><!--dynamic-component-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">two</div>')

        // change view -> 'one'
        // leave
        click(btnChangeSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-from test-leave-active">two</div><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test test-leave-active test-leave-to">two</div><!--dynamic-component-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<!--if--><!--dynamic-component-->')
      },
      E2E_TIMEOUT,
    )

    test(
      'wrapping transition + fallthrough attrs',
      async () => {
        const btnSelector = '.if-fallthrough-attr > button'
        const containerSelector = '.if-fallthrough-attr > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div foo="1">content</div>')

        await css(btnSelector).click()
        // toggle again before leave finishes
        await nextTick()
        await css(btnSelector).click()

        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div foo="1" class="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition + fallthrough attrs (in-out mode)',
      async () => {
        const btnSelector = '.if-fallthrough-attr-in-out > button'
        const containerSelector = '.if-fallthrough-attr-in-out > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div foo="1">one</div>')

        // toggle
        await css(btnSelector).click()
        await nextTick()
        await transitionFinish(200)
        let calls = (window as any).getCalls()
        expect(calls).toStrictEqual([
          'beforeEnter',
          'onEnter',
          'afterEnter',
          'beforeLeave',
          'onLeave',
          'afterLeave',
        ])

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div foo="1" class="">two</div>')

        // clear calls
        ;(window as any).resetCalls()

        // toggle back
        await css(btnSelector).click()
        await nextTick()
        await transitionFinish(200)

        calls = (window as any).getCalls()
        expect(calls).toStrictEqual([
          'beforeEnter',
          'onEnter',
          'afterEnter',
          'beforeLeave',
          'onLeave',
          'afterLeave',
        ])

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div foo="1" class="">one</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'prevent enter when leaving',
      async () => {
        const sectionSelector = '.if-prevent-enter-when-leaving'
        const btnSelector = `${sectionSelector} > button`
        const containerSelector = `${sectionSelector} .container`

        await css(btnSelector).click()
        await nextTick()
        await transitionFinish(100)

        const calls = (window as any).getCalls()
        expect(calls).toStrictEqual([
          'beforeEnter',
          'beforeLeave',
          'leave',
          'afterLeave',
        ])
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')
      },
      E2E_TIMEOUT,
    )
  })

  describe('transition with KeepAlive', () => {
    test('unmount innerChild (out-in mode)', async () => {
      const btnSelector = '.keep-alive > button'
      const containerSelector = '.keep-alive > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML('<div>0</div><!--if-->')

      await css(btnSelector).click()
      await transitionFinish()

      await expect
        .element(css(containerSelector))
        .toContainHTML('<div><!--if--></div>')
      const calls = (window as any).getCalls()
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

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div>CompA</div>')

        await css(btnSwitchToB).click()
        await nextTick()
        await css(btnSwitchToC).click()
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="">CompC</div>')

        await css(btnSwitchToA).click()
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="">CompA</div>')

        const calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['CompC unmounted'])

        // Unlike vdom, CompA does not update because there are no state changes
        // expect CompA only update once
        // calls = await page().evaluate(() => {
        //   return (window as any).getCalls()
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

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div>CompA2</div>')
        await css(btnSwitchToB).click()
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="">CompB2</div>')
        await css(btnSwitchToA).click()
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="">CompA2</div>')
        const calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['CompB2 unmounted'])
      },
      E2E_TIMEOUT,
    )

    // #12860
    test(
      'unmount children',
      async () => {
        const containerSelector = '.keep-alive-unmount-children > #container'
        const btnSelector = '.keep-alive-unmount-children > #toggleBtn'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div>0</div>')

        await css(btnSelector).click()
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        const calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['UnmountBranch'])

        const storageInner = (
          (window as any).getKeepAliveUnmountStorageContainer?.() as
            | HTMLElement
            | undefined
        )?.innerHTML
        expect(storageInner).toBe('')
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

        await expect
          .element(css(containerSelector))
          .toContainHTML(
            `<div><h2>I should show</h2></div>` +
              `<h2>This is page1</h2>` +
              `<button id="changeShowBtn">true</button>`,
          )
        // trigger v-show transition leave
        click(changeShowBtn)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-leave-from test-leave-active"><h2>I shouldn't show </h2></div>` +
            `<h2>This is page1</h2>` +
            `<button id="changeShowBtn">false</button><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-leave-active test-leave-to"><h2>I shouldn't show </h2></div>` +
            `<h2>This is page1</h2>` +
            `<button id="changeShowBtn">false</button><!--dynamic-component-->`,
        )

        // switch to page2, before leave finishes
        // expect v-show element's display to be none
        await css(btnToggle).click()
        await nextTick()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<h2>This is page2</h2>`)
        await expect
          .element(css(`${containerSelector} > div`))
          .toHaveAttribute('style', 'display: none;')

        // switch back to page1
        // expect v-show element's display to be none
        click(btnToggle)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-enter-from test-enter-active" style="display: none;"><h2>I shouldn't show </h2></div>` +
            `<h2>This is page1</h2>` +
            `<button id="changeShowBtn">false</button><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="test-enter-active test-enter-to" style="display: none;"><h2>I shouldn't show </h2></div>` +
            `<h2>This is page1</h2>` +
            `<button id="changeShowBtn">false</button><!--dynamic-component-->`,
        )

        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
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

        await expect.element(css(containerSelector)).toBeEmptyDOMElement()
        await expect.element(css(targetSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(targetSelector)).toContain(
          `<div class="test v-enter-from v-enter-active">vapor compB</div><!--if-->`,
        )
        await nextFrame()
        expect(html(targetSelector)).toContain(
          `<div class="test v-enter-active v-enter-to">vapor compB</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(targetSelector))
          .toContainHTML('<div class="test">vapor compB</div>')
        await expect.element(css(containerSelector)).toBeEmptyDOMElement()

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(targetSelector)).toContain(
          `<div class="test v-leave-from v-leave-active">vapor compB</div><!--if-->`,
        )
        await nextFrame()
        expect(html(targetSelector)).toContain(
          `<div class="test v-leave-active v-leave-to">vapor compB</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(targetSelector)).toContainHTML('<!--if-->')
        await expect.element(css(containerSelector)).toBeEmptyDOMElement()
      },
      E2E_TIMEOUT,
    )
  })

  describe('transition with AsyncComponent', () => {
    test('apply transition to inner component', async () => {
      const btnSelector = '.async > button'
      const containerSelector = '.async > div'

      await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

      // toggle
      click(btnSelector)
      await nextTick()
      await expect
        .element(css(containerSelector))
        .toContainHTML('<!--async component--><!--if-->')
      await waitForInnerHTML(
        containerSelector,
        '<div class="v-enter-from v-enter-active">vapor compA</div><!--async component--><!--if-->',
      )
      await waitForInnerHTML(
        containerSelector,
        '<div class="v-enter-active v-enter-to">vapor compA</div><!--async component--><!--if-->',
      )
      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          '<div class="">vapor compA</div><!--async component--><!--if-->',
        )

      // leave
      click(btnSelector)
      await nextTick()
      await nextFrame()
      expect(html(containerSelector)).toContain(
        '<div class="v-leave-from v-leave-active">vapor compA</div><!--if-->',
      )
      await nextFrame()
      expect(html(containerSelector)).toContain(
        '<div class="v-leave-active v-leave-to">vapor compA</div><!--if-->',
      )
      await transitionFinish()
      await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

      // enter again
      // use the already resolved component
      click(btnSelector)
      await nextTick()
      await nextFrame()
      expect(html(containerSelector)).toContain(
        '<div class="v-enter-from v-enter-active">vapor compA</div><!--async component--><!--if-->',
      )
      await nextFrame()
      expect(html(containerSelector)).toContain(
        '<div class="v-enter-active v-enter-to">vapor compA</div><!--async component--><!--if-->',
      )
      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          '<div class="">vapor compA</div><!--async component--><!--if-->',
        )
    })

    test('apply transition to pre-resolved async component', async () => {
      const btnSelector = '.async-resolved > button'
      const containerSelector = '.async-resolved #container'
      const hiddenCompSelector = '.async-resolved #hidden-async'

      // Wait for the hidden AsyncCompResolved to resolve and render
      await timeout(0)
      await expect
        .element(css(hiddenCompSelector))
        .toContainHTML('<div style="display: none;">vapor compA</div>')

      await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

      click(btnSelector)
      await nextTick()
      await nextFrame()
      expect(html(containerSelector)).toContain(
        '<div class="v-enter-from v-enter-active">vapor compA</div><!--async component--><!--if-->',
      )
      await nextFrame()
      expect(html(containerSelector)).toContain(
        '<div class="v-enter-active v-enter-to">vapor compA</div><!--async component--><!--if-->',
      )
      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          '<div class="">vapor compA</div><!--async component--><!--if-->',
        )

      // leave
      click(btnSelector)
      await nextTick()
      await nextFrame()
      expect(html(containerSelector)).toContain(
        '<div class="v-leave-from v-leave-active">vapor compA</div><!--if-->',
      )
      await nextFrame()
      expect(html(containerSelector)).toContain(
        '<div class="v-leave-active v-leave-to">vapor compA</div><!--if-->',
      )
      await transitionFinish()
      await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

      // enter again
      click(btnSelector)
      await nextTick()
      await nextFrame()
      expect(html(containerSelector)).toContain(
        '<div class="v-enter-from v-enter-active">vapor compA</div><!--async component--><!--if-->',
      )
      await nextFrame()
      expect(html(containerSelector)).toContain(
        '<div class="v-enter-active v-enter-to">vapor compA</div><!--async component--><!--if-->',
      )
      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          '<div class="">vapor compA</div><!--async component--><!--if-->',
        )
    })

    test(
      'different pre-resolved async types during leave',
      async () => {
        const rootSelector = '.different-pre-resolved-async-types-during-leave'
        const btnSelector = `${rootSelector} > button`
        const hiddenASelector = `${rootSelector} #hidden-a`
        const hiddenBSelector = `${rootSelector} #hidden-b`
        const containerSelector = `${rootSelector} #container`

        await timeout(0)
        await expect
          .element(css(hiddenASelector))
          .toContainHTML('<div style="display: none;">vapor compA</div>')
        await expect
          .element(css(hiddenBSelector))
          .toContainHTML('<div style="display: none;">vapor compB</div>')
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div>vapor compA</div>')

        ;(window as any).resetCalls()
        click(btnSelector)
        await nextTick()

        let calls = (window as any).getCalls()
        expect(calls).toContain('beforeEnter:vapor compB')
        expect(calls).toContain('enter:vapor compB')
        expect(calls).toContain('beforeLeave:vapor compA')
        expect(calls).toContain('leave:vapor compA')
        expect(calls).not.toContain('afterLeave:vapor compA')

        await transitionFinish()
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual([
          'beforeLeave:vapor compA',
          'leave:vapor compA',
          'beforeEnter:vapor compB',
          'enter:vapor compB',
          'afterLeave:vapor compA',
          'afterEnter:vapor compB',
        ])
      },
      E2E_TIMEOUT,
    )
  })

  describe('transition with v-show', () => {
    test(
      'named transition with v-show',
      async () => {
        const btnSelector = '.show-named > button'
        const containerSelector = '.show-named > div'
        const childSelector = `${containerSelector} > div`

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
        await expect.element(css(childSelector)).toBeVisible()

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-from test-leave-active">content</div>',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            '<div class="test" style="display: none;">content</div>',
          )
        await expect.element(css(childSelector)).not.toBeVisible()

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-from test-enter-active" style="">content</div>',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-active test-enter-to" style="">content</div>',
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test" style="">content</div>')
        await expect.element(css(childSelector)).toBeVisible()
      },
      E2E_TIMEOUT,
    )

    test(
      'transition events with v-show',
      async () => {
        const btnSelector = '.show-events > button'
        const containerSelector = '.show-events > div'
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-from test-leave-active">content</div>',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-active test-leave-to">content</div>',
        )

        let calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave'])
        calls = (window as any).getCalls()
        expect(calls).not.toContain('afterLeave')
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            '<div class="test" style="display: none;">content</div>',
          )
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeLeave', 'onLeave', 'afterLeave'])

        // clear calls
        ;(window as any).resetCalls()

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-from test-enter-active" style="">content</div>',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-active test-enter-to" style="">content</div>',
        )
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test" style="">content</div>')
        calls = (window as any).getCalls()
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

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-from test-leave-active">content</div>',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-active test-leave-to">content</div>',
        )

        // cancel (enter)
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-from test-enter-active" style="">content</div>',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-active test-enter-to" style="">content</div>',
        )
        let calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['leaveCancelled'])
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test" style="">content</div>')
        await expect.element(css(childSelector)).toBeVisible()
      },
      E2E_TIMEOUT,
    )

    test(
      'transition on appear with v-show',
      async () => {
        const btnSelector = '.show-appear > button'
        const containerSelector = '.show-appear > div'
        const childSelector = `${containerSelector} > div`

        let calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])

        // appear
        await expect
          .element(css(childSelector))
          .toHaveClass('test-appear-active')
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter', 'afterEnter'])

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-from test-leave-active">content</div>',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-active test-leave-to">content</div>',
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            '<div class="test" style="display: none;">content</div>',
          )

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-from test-enter-active" style="">content</div>',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-active test-enter-to" style="">content</div>',
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test" style="">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'transition events should not call onEnter with v-show false',
      async () => {
        const btnSelector = '.show-appear-not-enter > button'
        const containerSelector = '.show-appear-not-enter > div'
        const childSelector = `${containerSelector} > div`

        await expect.element(css(childSelector)).not.toBeVisible()
        let calls = (window as any).getCalls()
        expect(calls).toStrictEqual([])

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-from test-enter-active" style="">content</div>',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-active test-enter-to" style="">content</div>',
        )
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual(['beforeEnter', 'onEnter'])
        expect(calls).not.contain('afterEnter')
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test" style="">content</div>')
        calls = (window as any).getCalls()
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

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-from test-leave-active">content</div><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-active test-leave-to">content</div><!--if-->',
        )
        await transitionFinish(100)
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-from test-enter-active">content</div><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-active test-enter-to">content</div><!--if-->',
        )
        await transitionFinish(100)
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'enter with explicit durations',
      async () => {
        const btnSelector = '.duration-enter > button'
        const containerSelector = '.duration-enter > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-from test-leave-active">content</div><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-active test-leave-to">content</div><!--if-->',
        )
        await transitionFinish(50)
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-from test-enter-active">content</div><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-active test-enter-to">content</div><!--if-->',
        )
        await transitionFinish(100)
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'leave with explicit durations',
      async () => {
        const btnSelector = '.duration-leave > button'
        const containerSelector = '.duration-leave > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-from test-leave-active">content</div><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-active test-leave-to">content</div><!--if-->',
        )
        await transitionFinish(100)
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-from test-enter-active">content</div><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-active test-enter-to">content</div><!--if-->',
        )
        await transitionFinish(50)
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )

    test(
      'separate enter and leave',
      async () => {
        const btnSelector = '.duration-enter-leave > button'
        const containerSelector = '.duration-enter-leave > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')

        // leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-from test-leave-active">content</div><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-leave-active test-leave-to">content</div><!--if-->',
        )
        await transitionFinish(100)
        await expect.element(css(containerSelector)).toContainHTML('<!--if-->')

        // enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-from test-enter-active">content</div><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<div class="test test-enter-active test-enter-to">content</div><!--if-->',
        )
        await transitionFinish(200)
        await expect
          .element(css(containerSelector))
          .toContainHTML('<div class="test">content</div>')
      },
      E2E_TIMEOUT,
    )
  })

  describe('keyed', () => {
    test(
      'should work with static keyed element',
      async () => {
        const btnSelector = '.static-keyed > button'
        const containerSelector = '.static-keyed'
        const childSelector = '.static-keyed > h1'

        await expect.element(css(childSelector)).toContainHTML('0')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>toggle</button><h1 style="position: absolute" class="v-leave-from v-leave-active">0</h1><h1 style="position: absolute" class="v-enter-from v-enter-active">1</h1><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>toggle</button><h1 style="position: absolute" class="v-leave-active v-leave-to">0</h1><h1 style="position: absolute" class="v-enter-active v-enter-to">1</h1><!--if-->',
        )
        await transitionFinish()
        await expect.element(css(childSelector)).toContainHTML('1')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>toggle</button><h1 style="position: absolute" class="v-leave-from v-leave-active">1</h1><h1 style="position: absolute" class="v-enter-from v-enter-active">0</h1><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>toggle</button><h1 style="position: absolute" class="v-leave-active v-leave-to">1</h1><h1 style="position: absolute" class="v-enter-active v-enter-to">0</h1><!--if-->',
        )
        await transitionFinish()
        await expect.element(css(childSelector)).toContainHTML('0')
      },
      E2E_TIMEOUT,
    )

    test(
      'should work with static keyed component',
      async () => {
        const btnSelector = '.static-keyed-component > button'
        const containerSelector = '.static-keyed-component'
        const childSelector = '.static-keyed-component > h1'

        await expect.element(css(childSelector)).toContainHTML('0')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>toggle</button><h1 style="position: absolute" class="v-leave-from v-leave-active">0</h1><h1 style="position: absolute" class="v-enter-from v-enter-active">1</h1><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>toggle</button><h1 style="position: absolute" class="v-leave-active v-leave-to">0</h1><h1 style="position: absolute" class="v-enter-active v-enter-to">1</h1><!--if-->',
        )
        await transitionFinish()
        await expect.element(css(childSelector)).toContainHTML('1')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>toggle</button><h1 style="position: absolute" class="v-leave-from v-leave-active">1</h1><h1 style="position: absolute" class="v-enter-from v-enter-active">0</h1><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>toggle</button><h1 style="position: absolute" class="v-leave-active v-leave-to">1</h1><h1 style="position: absolute" class="v-enter-active v-enter-to">0</h1><!--if-->',
        )
        await transitionFinish()
        await expect.element(css(childSelector)).toContainHTML('0')
      },
      E2E_TIMEOUT,
    )

    test(
      'should work with keyed element',
      async () => {
        const btnSelector = '.keyed > button'
        const containerSelector = '.keyed'
        const childSelector = '.keyed > h1'

        await expect.element(css(childSelector)).toContainHTML('0')

        // change key
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>inc</button><h1 style="position: absolute" class="v-leave-from v-leave-active">0</h1><h1 style="position: absolute" class="v-enter-from v-enter-active">1</h1><!--keyed-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>inc</button><h1 style="position: absolute" class="v-leave-active v-leave-to">0</h1><h1 style="position: absolute" class="v-enter-active v-enter-to">1</h1><!--keyed-->',
        )
        await transitionFinish()
        await expect.element(css(childSelector)).toContainHTML('1')

        // change key again
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>inc</button><h1 style="position: absolute" class="v-leave-from v-leave-active">1</h1><h1 style="position: absolute" class="v-enter-from v-enter-active">2</h1><!--keyed-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>inc</button><h1 style="position: absolute" class="v-leave-active v-leave-to">1</h1><h1 style="position: absolute" class="v-enter-active v-enter-to">2</h1><!--keyed-->',
        )
        await transitionFinish()
        await expect.element(css(childSelector)).toContainHTML('2')
      },
      E2E_TIMEOUT,
    )

    test(
      'should work with reusable Transition + keyed element',
      async () => {
        const btnSelector = '.reusable-keyed > button'
        const containerSelector = '.reusable-keyed'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<h1 style="position: absolute">0</h1>')

        // change key
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>inc</button><h1 style="position: absolute" class="test-leave-from test-leave-active">0</h1><h1 style="position: absolute" class="test-enter-from test-enter-active">1</h1><!--keyed-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>inc</button><h1 style="position: absolute" class="test-leave-active test-leave-to">0</h1><h1 style="position: absolute" class="test-enter-active test-enter-to">1</h1><!--keyed-->',
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<h1 style="position: absolute" class="">1</h1>')

        // change key again
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>inc</button><h1 style="position: absolute" class="test-leave-from test-leave-active">1</h1><h1 style="position: absolute" class="test-enter-from test-enter-active">2</h1><!--keyed-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<button>inc</button><h1 style="position: absolute" class="test-leave-active test-leave-to">1</h1><h1 style="position: absolute" class="test-enter-active test-enter-to">2</h1><!--keyed-->',
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<h1 style="position: absolute" class="">2</h1>')
      },
      E2E_TIMEOUT,
    )
  })

  describe('dynamic component', () => {
    test(
      'different type during leave',
      async () => {
        const btnSelector = '.different-type-during-leave > button'

        ;(window as any).resetCalls()
        click(btnSelector)
        await nextTick()

        let calls = (window as any).getCalls()
        expect(calls).toContain('beforeEnter:span')
        expect(calls).toContain('enter:span')
        expect(calls).toContain('beforeLeave:div')
        expect(calls).toContain('leave:div')
        expect(calls).not.toContain('afterLeave:div')

        await transitionFinish(100)
        calls = (window as any).getCalls()
        expect(calls).toStrictEqual([
          'beforeLeave:div',
          'leave:div',
          'beforeEnter:span',
          'enter:span',
          'afterLeave:div',
          'afterEnter:span',
        ])
      },
      E2E_TIMEOUT,
    )
  })

  describe('mode', () => {
    test(
      'in-out mode with v-if',
      async () => {
        const btnSelector = '.in-out-if > button'
        const containerSelector = '.in-out-if > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div>text1</div>`)

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-from v-leave-active">text1</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-active v-leave-to">text1</div><!--if-->`,
        )
        await waitForInnerHTML(containerSelector, `<!--if-->`)
        await expect.element(css(containerSelector)).toContainHTML(`<!--if-->`)

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-enter-from v-enter-active">text1</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-enter-active v-enter-to">text1</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">text1</div><!--if-->`)
      },
      E2E_TIMEOUT,
    )

    // #14539
    test(
      'in-out mode with if/else rapid toggles',
      async () => {
        const btnSelector = '.in-out-if-else-rapid > button'
        const containerSelector = '.in-out-if-else-rapid > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div>2</div>`)

        click(btnSelector)
        await nextTick()
        expect(html(containerSelector)).toContain(
          `<div>2</div><div class="v-enter-from v-enter-active">1</div><!--if-->`,
        )

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-enter-from v-enter-active">1</div><div class="v-enter-from v-enter-active">2</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-enter-active v-enter-to">1</div><div class="v-enter-active v-enter-to">2</div><!--if-->`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="v-leave-from v-leave-active">1</div><div class="">2</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="v-leave-active v-leave-to">1</div><div class="">2</div><!--if-->`,
        )

        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">2</div><!--if-->`)

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="">2</div><div class="v-enter-from v-enter-active">1</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="">2</div><div class="v-enter-active v-enter-to">1</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="v-leave-from v-leave-active">2</div><div class="">1</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="v-leave-active v-leave-to">2</div><div class="">1</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">1</div><!--if-->`)

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="">1</div><div class="v-enter-from v-enter-active">2</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="">1</div><div class="v-enter-active v-enter-to">2</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="v-leave-from v-leave-active">1</div><div class="">2</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="v-leave-active v-leave-to">1</div><div class="">2</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">2</div><!--if-->`)
      },
      E2E_TIMEOUT,
    )

    test(
      'out-in mode with if/else-if',
      async () => {
        const btnSelector = '.out-in-if-else-if > button'
        const containerSelector = '.out-in-if-else-if > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div>text2</div>`)

        click(btnSelector)
        await nextTick()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div>text2</div>`)

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-from v-leave-active">text2</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-active v-leave-to">text2</div><!--if-->`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="v-enter-from v-enter-active">text1</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="v-enter-active v-enter-to">text1</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">text1</div><!--if-->`)

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-from v-leave-active">text1</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-active v-leave-to">text1</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="v-enter-from v-enter-active">text2</div><!--if--><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="v-enter-active v-enter-to">text2</div><!--if--><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">text2</div><!--if--><!--if-->`)
      },
      E2E_TIMEOUT,
    )

    test(
      'out-in mode with if/else-if empty branch',
      async () => {
        const btnSelector = '.out-in-if-else-if-empty > button'
        const containerSelector = '.out-in-if-else-if-empty > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div>text2</div>`)

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-from v-leave-active">text2</div><!--if--><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-active v-leave-to">text2</div><!--if--><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<!--if--><!--if-->`)

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-enter-from v-enter-active">text1</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-enter-active v-enter-to">text1</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">text1</div><!--if-->`)

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-from v-leave-active">text1</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-active v-leave-to">text1</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="v-enter-from v-enter-active">text2</div><!--if--><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="v-enter-active v-enter-to">text2</div><!--if--><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">text2</div><!--if--><!--if-->`)
      },
      E2E_TIMEOUT,
    )

    test(
      'should work with out-in mode',
      async () => {
        const btnSelector = '.out-in > button'
        const containerSelector = '.out-in > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div>vapor compB</div>`)

        // compB -> compA
        // compB leave
        // compA enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="fade-leave-from fade-leave-active">vapor compB</div><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="fade-leave-active fade-leave-to">vapor compB</div><!--dynamic-component-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-from fade-enter-active">vapor compA</div><!--dynamic-component-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-active fade-enter-to">vapor compA</div><!--dynamic-component-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            `<div class="">vapor compA</div><!--dynamic-component-->`,
          )

        // compA -> compB
        // compA leave
        // compB enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="fade-leave-from fade-leave-active">vapor compA</div><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="fade-leave-active fade-leave-to">vapor compA</div><!--dynamic-component-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-from fade-enter-active">vapor compB</div><!--dynamic-component-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-active fade-enter-to">vapor compB</div><!--dynamic-component-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            `<div class="">vapor compB</div><!--dynamic-component-->`,
          )
      },
      E2E_TIMEOUT,
    )

    test(
      'should work with in-out mode',
      async () => {
        const btnSelector = '.in-out > button'
        const containerSelector = '.in-out > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div>vapor compB</div>`)

        // compA enter
        // compB leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div>vapor compB</div><div class="fade-enter-from fade-enter-active">vapor compA</div><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div>vapor compB</div><div class="fade-enter-active fade-enter-to">vapor compA</div><!--dynamic-component-->`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-from fade-leave-active">vapor compB</div><div class="">vapor compA</div><!--dynamic-component-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-active fade-leave-to">vapor compB</div><div class="">vapor compA</div><!--dynamic-component-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            `<div class="">vapor compA</div><!--dynamic-component-->`,
          )
      },
      E2E_TIMEOUT,
    )
  })

  // tests for using vdom component in createVaporApp + vaporInteropPlugin
  describe('interop', () => {
    test(
      'should work with static keyed vdom component',
      async () => {
        const btnSelector = '.static-keyed-vdom > button'
        const containerSelector = '.static-keyed-vdom > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML('<h1 style="position: absolute;">0</h1>')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<h1 style="position: absolute;" class="v-leave-from v-leave-active">0</h1><h1 class="v-enter-from v-enter-active" style="position: absolute;">1</h1><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<h1 style="position: absolute;" class="v-leave-active v-leave-to">0</h1><h1 class="v-enter-active v-enter-to" style="position: absolute;">1</h1><!--if-->',
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<h1 class="" style="position: absolute;">1</h1>')

        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<h1 class="v-leave-from v-leave-active" style="position: absolute;">1</h1><h1 class="v-enter-from v-enter-active" style="position: absolute;">0</h1><!--if-->',
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          '<h1 class="v-leave-active v-leave-to" style="position: absolute;">1</h1><h1 class="v-enter-active v-enter-to" style="position: absolute;">0</h1><!--if-->',
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML('<h1 class="" style="position: absolute;">0</h1>')
      },
      E2E_TIMEOUT,
    )

    test(
      'render vdom component',
      async () => {
        const btnSelector = '.vdom > button'
        const containerSelector = '.vdom > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div>vdom comp</div>`)

        // comp leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-from v-leave-active">vdom comp</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-leave-active v-leave-to">vdom comp</div><!--if-->`,
        )
        await transitionFinish()
        await expect.element(css(containerSelector)).toContainHTML(`<!--if-->`)

        // comp enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-enter-from v-enter-active">vdom comp</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="v-enter-active v-enter-to">vdom comp</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">vdom comp</div>`)
      },
      E2E_TIMEOUT,
    )

    test(
      'switch between vdom/vapor component (out-in mode)',
      async () => {
        const btnSelector = '.vdom-vapor-out-in > button'
        const containerSelector = '.vdom-vapor-out-in > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div>vdom comp</div>`)

        // switch to vapor comp
        // vdom comp leave
        // vapor comp enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="fade-leave-from fade-leave-active">vdom comp</div><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="fade-leave-active fade-leave-to">vdom comp</div><!--dynamic-component-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-from fade-enter-active">vapor compA</div><!--dynamic-component-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-active fade-enter-to">vapor compA</div><!--dynamic-component-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            `<div class="">vapor compA</div><!--dynamic-component-->`,
          )

        // switch to vdom comp
        // vapor comp leave
        // vdom comp enter
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="fade-leave-from fade-leave-active">vapor compA</div><!--dynamic-component-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="fade-leave-active fade-leave-to">vapor compA</div><!--dynamic-component-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-from fade-enter-active">vdom comp</div><!--dynamic-component-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-enter-active fade-enter-to">vdom comp</div><!--dynamic-component-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            `<div class="">vdom comp</div><!--dynamic-component-->`,
          )
      },
      E2E_TIMEOUT,
    )

    test(
      'switch between vdom/vapor component (in-out mode)',
      async () => {
        const btnSelector = '.vdom-vapor-in-out > button'
        const containerSelector = '.vdom-vapor-in-out > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div>vapor compA</div>`)

        // switch to vdom comp
        // vdom comp enter
        // vapor comp leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div>vapor compA</div><div class="fade-enter-from fade-enter-active">vdom comp</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div>vapor compA</div><div class="fade-enter-active fade-enter-to">vdom comp</div><!--if-->`,
        )

        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-from fade-leave-active">vapor compA</div><div class="">vdom comp</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-active fade-leave-to">vapor compA</div><div class="">vdom comp</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">vdom comp</div><!--if-->`)

        // switch to vapor comp
        // vapor comp enter
        // vdom comp leave
        click(btnSelector)
        await nextTick()
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="">vdom comp</div><div class="fade-enter-from fade-enter-active">vapor compA</div><!--if-->`,
        )
        await nextFrame()
        expect(html(containerSelector)).toContain(
          `<div class="">vdom comp</div><div class="fade-enter-active fade-enter-to">vapor compA</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-from fade-leave-active">vdom comp</div><div class="">vapor compA</div><!--if-->`,
        )
        await waitForInnerHTML(
          containerSelector,
          `<div class="fade-leave-active fade-leave-to">vdom comp</div><div class="">vapor compA</div><!--if-->`,
        )
        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(`<div class="">vapor compA</div><!--if-->`)
      },
      E2E_TIMEOUT,
    )
  })
})
