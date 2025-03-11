import path from 'node:path'
import {
  E2E_TIMEOUT,
  setupPuppeteer,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import connect from 'connect'
import sirv from 'sirv'
import { expect } from 'vitest'
const { page, nextFrame, timeout, html, transitionStart, waitForElement } =
  setupPuppeteer()

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
      const childSelector = `${containerSelector} > div`

      // appear
      await waitForElement(childSelector, 'a', ['test-appear-active'])

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

  test.todo('dynamic name', async () => {})
  test.todo('events', async () => {})
  test.todo('warn unkeyed children', async () => {})
})
