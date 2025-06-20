import path from 'node:path'
import {
  E2E_TIMEOUT,
  setupPuppeteer,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import connect from 'connect'
import sirv from 'sirv'
import { expect } from 'vitest'
const { page, nextFrame, timeout, html, transitionStart } = setupPuppeteer()

const duration = process.env.CI ? 200 : 50
const buffer = process.env.CI ? 50 : 20
const transitionFinish = (time = duration) => timeout(time + buffer)

describe('vapor transition-group', () => {
  let server: any
  const port = '8196'
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
    const baseUrl = `http://localhost:${port}/transition-group/`
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

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<div class="test test-enter-active test-enter-to">e</div>`,
      )

      await transitionFinish()
      expect(await html(containerSelector)).toBe(
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

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test test-leave-active test-leave-to">c</div>`,
      )
      await transitionFinish()
      expect(await html(containerSelector)).toBe(`<div class="test">b</div>`)
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

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="test test-leave-active test-leave-to">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>`,
      )
      await transitionFinish()
      expect(await html(containerSelector)).toBe(
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

      await page().evaluate(() => {
        return (window as any).setAppear()
      })

      // appear
      expect(await html(containerSelector)).toBe(
        `<div class="test test-appear-from test-appear-active">a</div>` +
          `<div class="test test-appear-from test-appear-active">b</div>` +
          `<div class="test test-appear-from test-appear-active">c</div>`,
      )

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="test test-appear-active test-appear-to">a</div>` +
          `<div class="test test-appear-active test-appear-to">b</div>` +
          `<div class="test test-appear-active test-appear-to">c</div>`,
      )

      await transitionFinish()
      expect(await html(containerSelector)).toBe(
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

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="test">a</div>` +
          `<div class="test">b</div>` +
          `<div class="test">c</div>` +
          `<div class="test test-enter-active test-enter-to">d</div>` +
          `<div class="test test-enter-active test-enter-to">e</div>`,
      )

      await transitionFinish()
      expect(await html(containerSelector)).toBe(
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

      await nextFrame()
      expect(await html(containerSelector)).toBe(
        `<div class="test group-enter-active group-enter-to">d</div>` +
          `<div class="test">b</div>` +
          `<div class="test group-move" style="">a</div>` +
          `<div class="test group-leave-active group-move group-leave-to" style="">c</div>`,
      )
      await transitionFinish(duration * 2)
      expect(await html(containerSelector)).toBe(
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

    await transitionFinish()
    expect(await html(containerSelector)).toBe(
      `<div class="" style="">a</div>` +
        `<div class="" style="">b</div>` +
        `<div class="" style="">c</div>`,
    )
  })

  test('events', async () => {
    const btnSelector = '.events > button'
    const containerSelector = '.events > div'

    expect(await html('.events')).toBe(`<button>events button</button>`)

    await page().evaluate(() => {
      return (window as any).setAppear()
    })

    // appear
    expect(await html(containerSelector)).toBe(
      `<div class="test test-appear-from test-appear-active">a</div>` +
        `<div class="test test-appear-from test-appear-active">b</div>` +
        `<div class="test test-appear-from test-appear-active">c</div>`,
    )
    await nextFrame()
    expect(await html(containerSelector)).toBe(
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

    await transitionFinish()
    expect(await html(containerSelector)).toBe(
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

    await nextFrame()
    expect(await html(containerSelector)).toBe(
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

    await transitionFinish()
    expect(await html(containerSelector)).toBe(
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

  test('interop: render vdom component', async () => {
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

    await nextFrame()
    expect(await html(containerSelector)).toBe(
      `<div class="test-leave-active test-leave-to"><div>a</div></div>` +
        `<div class="test-move" style=""><div>b</div></div>` +
        `<div class="test-move" style=""><div>c</div></div>` +
        `<div class="test-enter-active test-enter-to"><div>d</div></div>`,
    )

    await transitionFinish()
    expect(await html(containerSelector)).toBe(
      `<div class="" style=""><div>b</div></div>` +
        `<div class="" style=""><div>c</div></div>` +
        `<div class=""><div>d</div></div>`,
    )
  })
})
