import {
  E2E_TIMEOUT,
  setupPuppeteer,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import { expect } from 'vitest'
import { startE2ETestServer } from './server'
const { page, html, transitionStart, waitForInnerHTML } = setupPuppeteer()

const appearTransitionStart = (containerSelector: string) =>
  page().evaluate(selector => {
    ;(window as any).setAppear()
    return Promise.resolve().then(
      () => (document.querySelector(selector) as HTMLElement)!.innerHTML,
    )
  }, containerSelector)

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

describe('vapor transition-group', () => {
  let server: Awaited<ReturnType<typeof startE2ETestServer>>
  let port = 0
  beforeAll(async () => {
    server = await startE2ETestServer('transition-group', import.meta.dirname)
    port = server.port
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(async () => {
    const testName = expect.getState().currentTestName || ''
    const caseId = resolveCaseId(testName)
    const baseUrl = `http://localhost:${port}/transition-group/?case=${caseId}`
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
  })

  test(
    'enter',
    async () => {
      const btnSelector = '.enter > button'
      const containerSelector = '.enter > div'

      expect(await html(containerSelector)).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-from test-enter-active">d</div>` +
          `<div class="test test-enter-from test-enter-active">e</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<div class="test test-enter-active test-enter-to">e</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
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

      expect(await html(containerSelector)).toBe(`<ul></ul>`)

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<ul>` +
          `<li class="test v-enter-from v-enter-active">0</li>` +
          `<li class="test v-enter-from v-enter-active">1</li>` +
          `</ul>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<ul>` +
          `<li class="test v-enter-active v-enter-to">0</li>` +
          `<li class="test v-enter-active v-enter-to">1</li>` +
          `</ul>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<ul><li class="test">0</li><li class="test">1</li></ul>`,
      )

      // add a new item
      expect(
        (await transitionStart(addBtnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<ul>` +
          `<li class="test">0</li>` +
          `<li class="test">1</li>` +
          `<li class="test v-enter-from v-enter-active">2</li>` +
          `</ul>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<ul>` +
          `<li class="test">0</li>` +
          `<li class="test">1</li>` +
          `<li class="test">2</li>` +
          `</ul>`,
      )
    },
    E2E_TIMEOUT,
  )

  test(
    'static keyed component enter',
    async () => {
      const btnSelector = '.static-keyed-component-enter > button'
      const containerSelector = '.static-keyed-component-enter > div'

      expect(await html(containerSelector)).toBe(``)

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div class="test test-enter-from test-enter-active">a</div>` +
          `<div class="test test-enter-from test-enter-active">b</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test test-enter-active test-enter-to">a</div>` +
          `<div class="test test-enter-active test-enter-to">b</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test">a</div><div class="test">b</div>`,
      )
    },
    E2E_TIMEOUT,
  )

  test(
    'static keyed enter',
    async () => {
      const btnSelector = '.static-keyed-enter > button'
      const containerSelector = '.static-keyed-enter > div'

      expect(await html(containerSelector)).toBe(``)

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div class="test test-enter-from test-enter-active">a</div>` +
          `<div class="test test-enter-from test-enter-active">b</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test test-enter-active test-enter-to">a</div>` +
          `<div class="test test-enter-active test-enter-to">b</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test">a</div><div class="test">b</div>`,
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
      expect(await html(containerSelector)).toBe(`<ul></ul>`)

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<ul>` +
          `<li class="test v-enter-from v-enter-active">0</li>` +
          `<li class="test v-enter-from v-enter-active">1</li>` +
          `</ul>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<ul>` +
          `<li class="test v-enter-active v-enter-to">0</li>` +
          `<li class="test v-enter-active v-enter-to">1</li>` +
          `</ul>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<ul><li class="test">0</li><li class="test">1</li></ul>`,
      )

      // add a new item
      expect(
        (await transitionStart(addBtnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<ul>` +
          `<li class="test">0</li>` +
          `<li class="test">1</li>` +
          `<li class="test v-enter-from v-enter-active">2</li>` +
          `</ul>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<ul>` +
          `<li class="test">0</li>` +
          `<li class="test">1</li>` +
          `<li class="test">2</li>` +
          `</ul>`,
      )
    },
    E2E_TIMEOUT,
  )

  test(
    'leave',
    async () => {
      const btnSelector = '.leave > button'
      const containerSelector = '.leave > div'

      expect(await html(containerSelector)).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div class="test test-leave-from test-leave-active">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test test-leave-from test-leave-active">c</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test test-leave-active test-leave-to">c</div>`,
      )

      await waitForInnerHTML(containerSelector, `<div class="test">b</div>`)
    },
    E2E_TIMEOUT,
  )

  test(
    'enter + leave',
    async () => {
      const btnSelector = '.enter-leave > button'
      const containerSelector = '.enter-leave > div'

      expect(await html(containerSelector)).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div class="test test-leave-from test-leave-active">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-from test-enter-active">d</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
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

      expect(await html('.appear')).toBe(`<button>appear button</button>`)

      // appear
      expect(await appearTransitionStart(containerSelector)).toBe(
        `<div class="test test-appear-from test-appear-active">a</div>` +
          `<div class="test test-appear-from test-appear-active">b</div>` +
          `<div class="test test-appear-from test-appear-active">c</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test test-appear-active test-appear-to">a</div>` +
          `<div class="test test-appear-active test-appear-to">b</div>` +
          `<div class="test test-appear-active test-appear-to">c</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      // enter
      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-from test-enter-active">d</div>` +
          `<div class="test test-enter-from test-enter-active">e</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<div class="test test-enter-active test-enter-to">e</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
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

      expect(await html(containerSelector)).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div class="test group-enter-from group-enter-active">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-from group-leave-active group-move" style="">c</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test group-enter-active group-enter-to">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-active group-move group-leave-to" style="">c</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
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

    expect(await html(containerSelector)).toBe(
      `<div>a</div>` + `<div>b</div>` + `<div>c</div>`,
    )

    // invalid name
    expect(
      (await transitionStart(btnSelector, containerSelector)).innerHTML,
    ).toBe(`<div>b</div>` + `<div>c</div>` + `<div>a</div>`)

    // change name
    expect(
      (await transitionStart(btnChangeName, containerSelector)).innerHTML,
    ).toBe(
      `<div class="group-move" style="">a</div>` +
        `<div class="group-move" style="">b</div>` +
        `<div class="group-move" style="">c</div>`,
    )

    await waitForInnerHTML(
      containerSelector,
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

    expect(await html(containerSelector)).toBe(
      `<div>` +
        `<div class="test">a</div>` +
        `<div class="test">b</div>` +
        `<div class="test">c</div>` +
        `</div>`,
    )

    // div -> section
    expect(
      (await transitionStart(btnSelector, containerSelector)).innerHTML,
    ).toBe(
      `<section>` +
        `<div class="test v-enter-from v-enter-active">a</div>` +
        `<div class="test v-enter-from v-enter-active">b</div>` +
        `<div class="test v-enter-from v-enter-active">c</div>` +
        `</section>`,
    )
    await waitForInnerHTML(
      containerSelector,
      `<section>` +
        `<div class="test v-enter-active v-enter-to">a</div>` +
        `<div class="test v-enter-active v-enter-to">b</div>` +
        `<div class="test v-enter-active v-enter-to">c</div>` +
        `</section>`,
    )
    await waitForInnerHTML(
      containerSelector,
      `<section>` +
        `<div class="test">a</div>` +
        `<div class="test">b</div>` +
        `<div class="test">c</div>` +
        `</section>`,
    )

    // section -> fragment
    expect(
      (await transitionStart(btnSelector, containerSelector)).innerHTML,
    ).toBe(
      `<div class="test v-enter-from v-enter-active">a</div>` +
        `<div class="test v-enter-from v-enter-active">b</div>` +
        `<div class="test v-enter-from v-enter-active">c</div>`,
    )
    await waitForInnerHTML(
      containerSelector,
      `<div class="test v-enter-active v-enter-to">a</div>` +
        `<div class="test v-enter-active v-enter-to">b</div>` +
        `<div class="test v-enter-active v-enter-to">c</div>`,
    )
    await waitForInnerHTML(
      containerSelector,
      `<div class="test">a</div>` +
        `<div class="test">b</div>` +
        `<div class="test">c</div>`,
    )

    // fragment -> div
    expect(
      (await transitionStart(btnSelector, containerSelector)).innerHTML,
    ).toBe(
      `<div>` +
        `<div class="test v-enter-from v-enter-active">a</div>` +
        `<div class="test v-enter-from v-enter-active">b</div>` +
        `<div class="test v-enter-from v-enter-active">c</div>` +
        `</div>`,
    )
    await waitForInnerHTML(
      containerSelector,
      `<div>` +
        `<div class="test v-enter-active v-enter-to">a</div>` +
        `<div class="test v-enter-active v-enter-to">b</div>` +
        `<div class="test v-enter-active v-enter-to">c</div>` +
        `</div>`,
    )
    await waitForInnerHTML(
      containerSelector,
      `<div>` +
        `<div class="test">a</div>` +
        `<div class="test">b</div>` +
        `<div class="test">c</div>` +
        `</div>`,
    )
  })

  test('dynamic tag render effect leak', async () => {
    const cycleBtnSelector = '.dynamic-tag-render-effect-leak > button.cycle'
    const addBtnSelector = '.dynamic-tag-render-effect-leak > button.add'
    const containerSelector = '.dynamic-tag-render-effect-leak > div'

    expect(await html(containerSelector)).toBe(
      `<div>` +
        `<div class="test">a</div>` +
        `<div class="test">b</div>` +
        `</div>`,
    )

    await page().evaluate(() => {
      ;(window as any).clearRenderCalls()
    })

    await transitionStart(cycleBtnSelector, containerSelector)
    await waitForInnerHTML(
      containerSelector,
      `<section>` +
        `<div class="test">a</div>` +
        `<div class="test">b</div>` +
        `</section>`,
    )

    await transitionStart(cycleBtnSelector, containerSelector)
    await waitForInnerHTML(
      containerSelector,
      `<div class="test">a</div>` + `<div class="test">b</div>`,
    )

    await transitionStart(cycleBtnSelector, containerSelector)
    await waitForInnerHTML(
      containerSelector,
      `<div>` +
        `<div class="test">a</div>` +
        `<div class="test">b</div>` +
        `</div>`,
    )

    await page().evaluate(() => {
      ;(window as any).clearRenderCalls()
    })

    await transitionStart(addBtnSelector, containerSelector)
    await waitForInnerHTML(
      containerSelector,
      `<div>` +
        `<div class="test">a</div>` +
        `<div class="test">b</div>` +
        `<div class="test">c</div>` +
        `</div>`,
    )

    expect(
      await page().evaluate(() => {
        return (window as any).getRenderCalls()
      }),
    ).toEqual(['c'])
  })

  test('events', async () => {
    const btnSelector = '.events > button'
    const containerSelector = '.events > div'

    expect(await html('.events')).toBe(`<button>events button</button>`)

    // appear
    expect(await appearTransitionStart(containerSelector)).toBe(
      `<div class="test test-appear-from test-appear-active">a</div>` +
        `<div class="test test-appear-from test-appear-active">b</div>` +
        `<div class="test test-appear-from test-appear-active">c</div>`,
    )

    await waitForInnerHTML(
      containerSelector,
      `<div class="test test-appear-active test-appear-to">a</div>` +
        `<div class="test test-appear-active test-appear-to">b</div>` +
        `<div class="test test-appear-active test-appear-to">c</div>`,
    )

    let calls = await page().evaluate(() => {
      return (window as any).getCalls()
    })
    expect(calls).toContain('beforeAppear')
    expect(calls).toContain('onAppear')
    expect(calls).not.toContain('afterAppear')

    await waitForInnerHTML(
      containerSelector,
      `<div class="test">a</div>` +
        `<div class="test">b</div>` +
        `<div class="test">c</div>`,
    )

    expect(
      await page().evaluate(() => {
        return (window as any).getCalls()
      }),
    ).toContain('afterAppear')

    // enter + leave
    expect(
      (await transitionStart(btnSelector, containerSelector)).innerHTML,
    ).toBe(
      `<div class="test test-leave-from test-leave-active">a</div>` +
        `<div class="test">b</div>` +
        `<div class="test">c</div>` +
        `<div class="test test-enter-from test-enter-active">d</div>`,
    )

    calls = await page().evaluate(() => {
      return (window as any).getCalls()
    })
    expect(calls).toContain('beforeLeave')
    expect(calls).toContain('onLeave')
    expect(calls).not.toContain('afterLeave')
    expect(calls).toContain('beforeEnter')
    expect(calls).toContain('onEnter')
    expect(calls).not.toContain('afterEnter')

    await waitForInnerHTML(
      containerSelector,
      `<div class="test test-leave-active test-leave-to">a</div>` +
        `<div class="test">b</div>` +
        `<div class="test">c</div>` +
        `<div class="test test-enter-active test-enter-to">d</div>`,
    )

    calls = await page().evaluate(() => {
      return (window as any).getCalls()
    })
    expect(calls).not.toContain('afterLeave')
    expect(calls).not.toContain('afterEnter')

    await waitForInnerHTML(
      containerSelector,
      `<div class="test">b</div>` +
        `<div class="test">c</div>` +
        `<div class="test">d</div>`,
    )

    calls = await page().evaluate(() => {
      return (window as any).getCalls()
    })
    expect(calls).toContain('afterLeave')
    expect(calls).toContain('afterEnter')
  })

  test(
    'reusable transition group',
    async () => {
      const btnSelector = '.reusable-transition-group > button'
      const containerSelector = '.reusable-transition-group > div'

      expect(await html(containerSelector)).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>`,
      )

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div class="test group-enter-from group-enter-active">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-from group-leave-active group-move" style="">c</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test group-enter-active group-enter-to">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-active group-move group-leave-to" style="">c</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test" style="">a</div>`,
      )
    },
    E2E_TIMEOUT,
  )

  describe('interop', () => {
    test('static keyed vdom component enter', async () => {
      const btnSelector = '.static-keyed-vdom-component-enter > button'
      const containerSelector = '.static-keyed-vdom-component-enter > div'

      expect(await html(containerSelector)).toBe(``)

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div class="test test-enter-from test-enter-active">a</div>` +
          `<div class="test test-enter-from test-enter-active">b</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test test-enter-active test-enter-to">a</div>` +
          `<div class="test test-enter-active test-enter-to">b</div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test">a</div><div class="test">b</div>`,
      )
    })

    test('render vdom component', async () => {
      const btnSelector = '.interop > button'
      const containerSelector = '.interop > div'

      expect(await html(containerSelector)).toBe(
        `<div><div>a</div></div>` +
          `<div><div>b</div></div>` +
          `<div><div>c</div></div>`,
      )

      expect(
        (await transitionStart(btnSelector, containerSelector)).innerHTML,
      ).toBe(
        `<div class="test-leave-from test-leave-active"><div>a</div></div>` +
          `<div class="test-move" style=""><div>b</div></div>` +
          `<div class="test-move" style=""><div>c</div></div>` +
          `<div class="test-enter-from test-enter-active"><div>d</div></div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="test-leave-active test-leave-to"><div>a</div></div>` +
          `<div class="test-move" style=""><div>b</div></div>` +
          `<div class="test-move" style=""><div>c</div></div>` +
          `<div class="test-enter-active test-enter-to"><div>d</div></div>`,
      )

      await waitForInnerHTML(
        containerSelector,
        `<div class="" style=""><div>b</div></div>` +
          `<div class="" style=""><div>c</div></div>` +
          `<div class=""><div>d</div></div>`,
      )
    })
  })
})
