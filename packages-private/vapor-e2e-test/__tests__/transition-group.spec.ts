import { createVaporApp, nextTick, vaporInteropPlugin } from 'vue'
import { expect } from 'vitest'
import App from '../transition-group/App.vue'
import '../../../packages/vue/__tests__/e2e/style.css'
import {
  E2E_TIMEOUT,
  click,
  css,
  expectTransitionSnapshotSequence,
  nextFrame,
  transitionFinish,
} from './e2eUtils'

const appearTransitionStart = (containerSelector: string) => {
  ;(window as any).setAppear()
  return Promise.resolve().then(
    () => (css(containerSelector).element() as HTMLElement).innerHTML,
  )
}

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
    throw new Error(`[transition-group] Invalid test name: "${testName}"`)
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

describe('vapor transition-group', () => {
  test(
    'enter',
    async () => {
      const btnSelector = '.enter > button'
      const containerSelector = '.enter > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">a</div>` +
            `<div class="test">b</div>` +
            `<div class="test">c</div>`,
        )

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-from test-enter-active">d</div>` +
          `<div class="test test-enter-from test-enter-active">e</div>` +
          `<!--for--><!--transition-group-->`,
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<div class="test test-enter-active test-enter-to">e</div>` +
          `<!--for--><!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
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
    'if + for enter',
    async () => {
      const btnSelector = '.if-for-enter > button.toggle'
      const addBtnSelector = '.if-for-enter > button.add'
      const containerSelector = '.if-for-enter > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML(`<ul><!--if--></ul>`)

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<ul>` +
          `<li class="test v-enter-from v-enter-active">0</li>` +
          `<li class="test v-enter-from v-enter-active">1</li>` +
          `<!--for--><!--if--></ul>` +
          `<!--transition-group-->`,
        `<ul>` +
          `<li class="test v-enter-active v-enter-to">0</li>` +
          `<li class="test v-enter-active v-enter-to">1</li>` +
          `<!--for--><!--if--></ul>` +
          `<!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<ul><li class="test">0</li><li class="test">1</li><!--for--><!--if--></ul>`,
        )

      // add a new item
      await expectTransitionSnapshotSequence(
        addBtnSelector,
        containerSelector,
        [
          `<ul>` +
            `<li class="test">0</li>` +
            `<li class="test">1</li>` +
            `<li class="test v-enter-from v-enter-active">2</li>` +
            `<!--for--><!--if--></ul>` +
            `<!--transition-group-->`,
          `<ul>` +
            `<li class="test">0</li>` +
            `<li class="test">1</li>` +
            `<li class="test v-enter-active v-enter-to">2</li>` +
            `<!--for--><!--if--></ul>` +
            `<!--transition-group-->`,
        ],
      )

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<ul>` +
            `<li class="test">0</li>` +
            `<li class="test">1</li>` +
            `<li class="test">2</li>` +
            `<!--for--><!--if--></ul>`,
        )
    },
    E2E_TIMEOUT,
  )

  test(
    'static keyed component enter',
    async () => {
      const btnSelector = '.static-keyed-component-enter > button'
      const containerSelector = '.static-keyed-component-enter > div'

      await expect.element(css(containerSelector)).toBeEmptyDOMElement()

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="test test-enter-from test-enter-active">a</div>` +
          `<!--if-->` +
          `<div class="test test-enter-from test-enter-active">b</div>` +
          `<!--if--><!--transition-group-->`,
        `<div class="test test-enter-active test-enter-to">a</div>` +
          `<!--if-->` +
          `<div class="test test-enter-active test-enter-to">b</div>` +
          `<!--if--><!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">a</div><!--if--><div class="test">b</div><!--if-->`,
        )
    },
    E2E_TIMEOUT,
  )

  test(
    'static keyed enter',
    async () => {
      const btnSelector = '.static-keyed-enter > button'
      const containerSelector = '.static-keyed-enter > div'

      await expect.element(css(containerSelector)).toBeEmptyDOMElement()

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="test test-enter-from test-enter-active">a</div>` +
          `<!--if-->` +
          `<div class="test test-enter-from test-enter-active">b</div>` +
          `<!--if--><!--transition-group-->`,
        `<div class="test test-enter-active test-enter-to">a</div>` +
          `<!--if-->` +
          `<div class="test test-enter-active test-enter-to">b</div>` +
          `<!--if--><!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">a</div><!--if--><div class="test">b</div><!--if-->`,
        )
    },
    E2E_TIMEOUT,
  )

  test(
    'for + if enter',
    async () => {
      const btnSelector = '.for-if-enter > button.toggle'
      const addBtnSelector = '.for-if-enter > button.add'
      const containerSelector = '.for-if-enter > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML(`<ul><!--if--><!--if--><!--for--></ul>`)

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<ul>` +
          `<li class="test v-enter-from v-enter-active">0</li>` +
          `<!--keyed--><!--if-->` +
          `<li class="test v-enter-from v-enter-active">1</li>` +
          `<!--keyed--><!--if--><!--for--></ul>` +
          `<!--transition-group-->`,
        `<ul>` +
          `<li class="test v-enter-active v-enter-to">0</li>` +
          `<!--keyed--><!--if-->` +
          `<li class="test v-enter-active v-enter-to">1</li>` +
          `<!--keyed--><!--if--><!--for--></ul>` +
          `<!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<ul><li class="test">0</li><!--keyed--><!--if--><li class="test">1</li><!--keyed--><!--if--><!--for--></ul>`,
        )

      // add a new item
      await expectTransitionSnapshotSequence(
        addBtnSelector,
        containerSelector,
        [
          `<ul>` +
            `<li class="test">0</li>` +
            `<!--keyed--><!--if-->` +
            `<li class="test">1</li>` +
            `<!--keyed--><!--if-->` +
            `<li class="test v-enter-from v-enter-active">2</li>` +
            `<!--keyed--><!--if--><!--for--></ul>` +
            `<!--transition-group-->`,
          `<ul>` +
            `<li class="test">0</li>` +
            `<!--keyed--><!--if-->` +
            `<li class="test">1</li>` +
            `<!--keyed--><!--if-->` +
            `<li class="test v-enter-active v-enter-to">2</li>` +
            `<!--keyed--><!--if--><!--for--></ul>` +
            `<!--transition-group-->`,
        ],
      )

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<ul>` +
            `<li class="test">0</li>` +
            `<!--keyed--><!--if-->` +
            `<li class="test">1</li>` +
            `<!--keyed--><!--if-->` +
            `<li class="test">2</li>` +
            `<!--keyed--><!--if--><!--for--></ul>`,
        )
    },
    E2E_TIMEOUT,
  )

  test(
    'leave',
    async () => {
      const btnSelector = '.leave > button'
      const containerSelector = '.leave > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">a</div>` +
            `<div class="test">b</div>` +
            `<div class="test">c</div>`,
        )

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="test test-leave-from test-leave-active">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test test-leave-from test-leave-active">c</div>` +
          `<!--for--><!--transition-group-->`,
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test test-leave-active test-leave-to">c</div>` +
          `<!--for--><!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(`<div class="test">b</div>`)
    },
    E2E_TIMEOUT,
  )

  test(
    'enter + leave',
    async () => {
      const btnSelector = '.enter-leave > button'
      const containerSelector = '.enter-leave > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">a</div>` +
            `<div class="test">b</div>` +
            `<div class="test">c</div>`,
        )

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="test test-leave-from test-leave-active">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-from test-enter-active">d</div>` +
          `<!--for--><!--transition-group-->`,
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<!--for--><!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
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
      const btnSelector = '.appear > button'
      const containerSelector = '.appear > div'

      await expect
        .element(css('.appear'))
        .toContainHTML(`<button>appear button</button>`)

      // appear
      expect(await appearTransitionStart(containerSelector)).toBe(
        `<div class="test test-appear-from test-appear-active">a</div>` +
          `<div class="test test-appear-from test-appear-active">b</div>` +
          `<div class="test test-appear-from test-appear-active">c</div>` +
          `<!--for--><!--transition-group-->`,
      )

      await nextFrame()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test test-appear-active test-appear-to">a</div>` +
            `<div class="test test-appear-active test-appear-to">b</div>` +
            `<div class="test test-appear-active test-appear-to">c</div>` +
            `<!--for--><!--transition-group-->`,
        )

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">a</div>` +
            `<div class="test">b</div>` +
            `<div class="test">c</div>`,
        )

      // enter
      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-from test-enter-active">d</div>` +
          `<div class="test test-enter-from test-enter-active">e</div>` +
          `<!--for--><!--transition-group-->`,
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<div class="test test-enter-active test-enter-to">e</div>` +
          `<!--for--><!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
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
      const btnSelector = '.move > button'
      const containerSelector = '.move > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">a</div>` +
            `<div class="test">b</div>` +
            `<div class="test">c</div>`,
        )

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="test group-enter-from group-enter-active">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-from group-leave-active group-move" style="">c</div>` +
          `<!--for--><!--transition-group-->`,
        `<div class="test group-enter-active group-enter-to">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-active group-move group-leave-to" style="">c</div>` +
          `<!--for--><!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">d</div>` +
            `<div class="test">b</div>` +
            `<div class="test" style="">a</div>`,
        )
    },
    E2E_TIMEOUT,
  )

  test('dynamic name', async () => {
    const btnSelector = '.dynamic-name button.toggleBtn'
    const btnChangeName = '.dynamic-name button.changeNameBtn'
    const containerSelector = '.dynamic-name > div'

    await expect
      .element(css(containerSelector))
      .toContainHTML(`<div>a</div>` + `<div>b</div>` + `<div>c</div>`)

    // invalid name
    click(btnSelector)
    await nextTick()
    await expect
      .element(css(containerSelector))
      .toContainHTML(`<div>b</div>` + `<div>c</div>` + `<div>a</div>`)

    // change name
    await expectTransitionSnapshotSequence(btnChangeName, containerSelector, [
      `<div class="group-move" style="">a</div>` +
        `<div class="group-move" style="">b</div>` +
        `<div class="group-move" style="">c</div>` +
        `<!--for--><!--transition-group-->`,
    ])

    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div class="" style="">a</div>` +
          `<div class="" style="">b</div>` +
          `<div class="" style="">c</div>`,
      )
  })

  // Dynamic tag changes have no leave transition, only enter transition.
  // This matches vdom transition-group behavior.
  test('dynamic tag', async () => {
    const btnSelector = '.dynamic-tag > button'
    const containerSelector = '.dynamic-tag > div'

    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div>` +
          `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<!--for-->` +
          `</div>`,
      )

    // div -> section
    await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
      `<section>` +
        `<div class="test v-enter-from v-enter-active">a</div>` +
        `<div class="test v-enter-from v-enter-active">b</div>` +
        `<div class="test v-enter-from v-enter-active">c</div>` +
        `<!--for--></section>` +
        `<!--transition-group-->`,
      `<section>` +
        `<div class="test v-enter-active v-enter-to">a</div>` +
        `<div class="test v-enter-active v-enter-to">b</div>` +
        `<div class="test v-enter-active v-enter-to">c</div>` +
        `<!--for--></section>` +
        `<!--transition-group-->`,
    ])
    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<section>` +
          `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<!--for-->` +
          `</section>`,
      )

    // section -> fragment
    await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
      `<div class="test v-enter-from v-enter-active">a</div>` +
        `<div class="test v-enter-from v-enter-active">b</div>` +
        `<div class="test v-enter-from v-enter-active">c</div>` +
        `<!--for--><!--transition-group-->`,
      `<div class="test v-enter-active v-enter-to">a</div>` +
        `<div class="test v-enter-active v-enter-to">b</div>` +
        `<div class="test v-enter-active v-enter-to">c</div>` +
        `<!--for--><!--transition-group-->`,
    ])
    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<!--for-->`,
      )

    // fragment -> div
    await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
      `<div>` +
        `<div class="test v-enter-from v-enter-active">a</div>` +
        `<div class="test v-enter-from v-enter-active">b</div>` +
        `<div class="test v-enter-from v-enter-active">c</div>` +
        `<!--for--></div>` +
        `<!--transition-group-->`,
      `<div>` +
        `<div class="test v-enter-active v-enter-to">a</div>` +
        `<div class="test v-enter-active v-enter-to">b</div>` +
        `<div class="test v-enter-active v-enter-to">c</div>` +
        `<!--for--></div>` +
        `<!--transition-group-->`,
    ])
    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div>` +
          `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<!--for-->` +
          `</div>`,
      )
  })

  test('dynamic tag render effect leak', async () => {
    const cycleBtnSelector = '.dynamic-tag-render-effect-leak > button.cycle'
    const addBtnSelector = '.dynamic-tag-render-effect-leak > button.add'
    const containerSelector = '.dynamic-tag-render-effect-leak > div'

    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div>` +
          `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<!--for-->` +
          `</div>`,
      )

    ;(window as any).clearRenderCalls()

    click(cycleBtnSelector)
    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<section>` +
          `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<!--for-->` +
          `</section>`,
      )

    click(cycleBtnSelector)
    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div class="test">a</div><div class="test">b</div><!--for-->`,
      )

    click(cycleBtnSelector)
    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div>` +
          `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<!--for-->` +
          `</div>`,
      )

    ;(window as any).clearRenderCalls()

    click(addBtnSelector)
    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div>` +
          `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<!--for-->` +
          `</div>`,
      )

    expect((window as any).getRenderCalls()).toEqual(['c'])
  })

  test('events', async () => {
    const btnSelector = '.events > button'
    const containerSelector = '.events > div'

    await expect
      .element(css('.events'))
      .toContainHTML(`<button>events button</button>`)

    // appear
    expect(await appearTransitionStart(containerSelector)).toBe(
      `<div class="test test-appear-from test-appear-active">a</div>` +
        `<div class="test test-appear-from test-appear-active">b</div>` +
        `<div class="test test-appear-from test-appear-active">c</div>` +
        `<!--for--><!--transition-group-->`,
    )

    await nextFrame()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div class="test test-appear-active test-appear-to">a</div>` +
          `<div class="test test-appear-active test-appear-to">b</div>` +
          `<div class="test test-appear-active test-appear-to">c</div>` +
          `<!--for--><!--transition-group-->`,
      )

    let calls = (window as any).getCalls()
    expect(calls).toContain('beforeAppear')
    expect(calls).toContain('onAppear')
    expect(calls).not.toContain('afterAppear')

    await transitionFinish()
    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

    expect((window as any).getCalls()).toContain('afterAppear')

    // enter + leave
    await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
      `<div class="test test-leave-from test-leave-active">a</div>` +
        `<div class="test">b</div>` +
        `<div class="test">c</div>` +
        `<div class="test test-enter-from test-enter-active">d</div>` +
        `<!--for--><!--transition-group-->`,
      `<div class="test test-leave-active test-leave-to">a</div>` +
        `<div class="test">b</div>` +
        `<div class="test">c</div>` +
        `<div class="test test-enter-active test-enter-to">d</div>` +
        `<!--for--><!--transition-group-->`,
    ])

    calls = (window as any).getCalls()
    expect(calls).toContain('beforeLeave')
    expect(calls).toContain('onLeave')
    expect(calls).not.toContain('afterLeave')
    expect(calls).toContain('beforeEnter')
    expect(calls).toContain('onEnter')
    expect(calls).not.toContain('afterEnter')

    await transitionFinish(100)
    calls = (window as any).getCalls()
    expect(calls).toContain('afterLeave')
    expect(calls).toContain('afterEnter')

    await expect
      .element(css(containerSelector))
      .toContainHTML(
        `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test">d</div>`,
      )
  })

  test(
    'reusable transition group',
    async () => {
      const btnSelector = '.reusable-transition-group > button'
      const containerSelector = '.reusable-transition-group > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">a</div>` +
            `<div class="test">b</div>` +
            `<div class="test">c</div>`,
        )

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="test group-enter-from group-enter-active">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-from group-leave-active group-move" style="">c</div>` +
          `<!--for--><!--slot--><!--transition-group-->`,
        `<div class="test group-enter-active group-enter-to">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-active group-move group-leave-to" style="">c</div>` +
          `<!--for--><!--slot--><!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">d</div>` +
            `<div class="test">b</div>` +
            `<div class="test" style="">a</div>`,
        )
    },
    E2E_TIMEOUT,
  )

  describe('interop', () => {
    test(
      'avoid set transition hooks for comment node',
      async () => {
        const btnSelector =
          '.avoid-set-transition-hooks-for-comment-node > button'
        const containerSelector =
          '.avoid-set-transition-hooks-for-comment-node > div'

        await expect
          .element(css(containerSelector))
          .toContainHTML(`<!--v-if-->`)

        await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
          `<div class="test test-enter-from test-enter-active">a</div>` +
            `<div class="test test-enter-from test-enter-active">b</div>` +
            `<div class="test test-enter-from test-enter-active">c</div>` +
            `<!--for--><!--v-if--><!--transition-group-->`,
          `<div class="test test-enter-active test-enter-to">a</div>` +
            `<div class="test test-enter-active test-enter-to">b</div>` +
            `<div class="test test-enter-active test-enter-to">c</div>` +
            `<!--for--><!--v-if--><!--transition-group-->`,
        ])

        await transitionFinish(80)
        expect([
          `<div class="test">a</div>` +
            `<div class="test">b</div>` +
            `<div class="test">c</div>` +
            `<!--for--><!--v-if--><!--transition-group-->`,
          `<div class="test">a</div>` +
            `<div class="test">b</div>` +
            `<div class="test">c</div>` +
            `<!--for-->` +
            `<div class="test test-enter-from test-enter-active">child</div>` +
            `<!--transition-group-->`,
        ]).toContain(
          (css(containerSelector).element() as HTMLElement).innerHTML,
        )

        await expect
          .element(css(containerSelector))
          .toContainHTML(
            `<div class="test">a</div>` +
              `<div class="test">b</div>` +
              `<div class="test">c</div>` +
              `<!--for-->` +
              `<div class="test test-enter-active test-enter-to">child</div>`,
          )

        await transitionFinish()
        await expect
          .element(css(containerSelector))
          .toContainHTML(
            `<div class="test">a</div>` +
              `<div class="test">b</div>` +
              `<div class="test">c</div>` +
              `<!--for-->` +
              `<div class="test">child</div>`,
          )
      },
      E2E_TIMEOUT,
    )

    test('unkeyed vdom component update', async () => {
      const btnSelector = '.unkeyed-vdom-component-update > button'
      const containerSelector = '.unkeyed-vdom-component-update > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML(`<div><div>a</div></div>`)

      click(btnSelector)
      await nextTick()

      await expect
        .element(css(containerSelector))
        .toContainHTML(`<div><div>a</div></div><div class="test">b</div>`)
    })

    test('static keyed vdom component enter', async () => {
      const btnSelector = '.static-keyed-vdom-component-enter > button'
      const containerSelector = '.static-keyed-vdom-component-enter > div'

      await expect.element(css(containerSelector)).toBeEmptyDOMElement()

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="test test-enter-from test-enter-active">a</div>` +
          `<!--if-->` +
          `<div class="test test-enter-from test-enter-active">b</div>` +
          `<!--if--><!--transition-group-->`,
        `<div class="test test-enter-active test-enter-to">a</div>` +
          `<!--if-->` +
          `<div class="test test-enter-active test-enter-to">b</div>` +
          `<!--if--><!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="test">a</div><!--if--><div class="test">b</div><!--if-->`,
        )
    })

    test('render vdom component', async () => {
      const btnSelector = '.interop > button'
      const containerSelector = '.interop > div'

      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div><div>a</div></div>` +
            `<div><div>b</div></div>` +
            `<div><div>c</div></div>`,
        )

      await expectTransitionSnapshotSequence(btnSelector, containerSelector, [
        `<div class="test-leave-from test-leave-active"><div>a</div></div>` +
          `<div class="test-move" style=""><div>b</div></div>` +
          `<div class="test-move" style=""><div>c</div></div>` +
          `<div class="test-enter-from test-enter-active"><div>d</div></div>` +
          `<!--for--><!--transition-group-->`,
        `<div class="test-leave-active test-leave-to"><div>a</div></div>` +
          `<div class="test-move" style=""><div>b</div></div>` +
          `<div class="test-move" style=""><div>c</div></div>` +
          `<div class="test-enter-active test-enter-to"><div>d</div></div>` +
          `<!--for--><!--transition-group-->`,
      ])

      await transitionFinish()
      await expect
        .element(css(containerSelector))
        .toContainHTML(
          `<div class="" style=""><div>b</div></div>` +
            `<div class="" style=""><div>c</div></div>` +
            `<div class=""><div>d</div></div>`,
        )
    })
  })
})
