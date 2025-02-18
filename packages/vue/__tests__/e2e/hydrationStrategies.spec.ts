import path from 'node:path'
import { setupPuppeteer } from './e2eUtils'
import type { Ref } from '../../src/runtime'

declare const window: Window & {
  isHydrated: boolean
  isRootMounted: boolean
  teardownCalled?: boolean
  show: Ref<boolean>
}

describe('async component hydration strategies', () => {
  const { page, click, text, count } = setupPuppeteer(['--window-size=800,600'])

  async function goToCase(name: string, query = '') {
    const file = `file://${path.resolve(__dirname, `./hydration-strat-${name}.html${query}`)}`
    await page().goto(file)
  }

  async function assertHydrationSuccess(n = '1') {
    await click('button')
    expect(await text('button')).toBe(n)
  }

  test('idle', async () => {
    const messages: string[] = []
    page().on('console', e => messages.push(e.text()))

    await goToCase('idle')
    // not hydrated yet
    expect(await page().evaluate(() => window.isHydrated)).toBe(false)
    // wait for hydration
    await page().waitForFunction(() => window.isHydrated)
    // assert message order: hyration should happen after already queued main thread work
    expect(messages.slice(1)).toMatchObject(['resolve', 'busy', 'hydrated'])
    await assertHydrationSuccess()
  })

  test('visible', async () => {
    await goToCase('visible')
    await page().waitForFunction(() => window.isRootMounted)
    expect(await page().evaluate(() => window.isHydrated)).toBe(false)
    // scroll down
    await page().evaluate(() => window.scrollTo({ top: 1000 }))
    await page().waitForFunction(() => window.isHydrated)
    await assertHydrationSuccess()
  })

  test('visible (with rootMargin)', async () => {
    await goToCase('visible', '?rootMargin=1000')
    await page().waitForFunction(() => window.isRootMounted)
    // should hydrate without needing to scroll
    await page().waitForFunction(() => window.isHydrated)
    await assertHydrationSuccess()
  })

  test('visible (fragment)', async () => {
    await goToCase('visible', '?fragment')
    await page().waitForFunction(() => window.isRootMounted)
    expect(await page().evaluate(() => window.isHydrated)).toBe(false)
    expect(await count('span')).toBe(2)
    // scroll down
    await page().evaluate(() => window.scrollTo({ top: 1000 }))
    await page().waitForFunction(() => window.isHydrated)
    await assertHydrationSuccess()
  })

  test('visible (root v-if) should not throw error', async () => {
    const spy = vi.fn()
    const currentPage = page()
    currentPage.on('pageerror', spy)
    await goToCase('visible', '?v-if')
    await page().waitForFunction(() => window.isRootMounted)
    expect(await page().evaluate(() => window.isHydrated)).toBe(false)
    expect(spy).toBeCalledTimes(0)
    currentPage.off('pageerror', spy)
  })

  test('media query', async () => {
    await goToCase('media')
    await page().waitForFunction(() => window.isRootMounted)
    expect(await page().evaluate(() => window.isHydrated)).toBe(false)
    // resize
    await page().setViewport({ width: 400, height: 600 })
    await page().waitForFunction(() => window.isHydrated)
    await assertHydrationSuccess()
  })

  test('interaction', async () => {
    await goToCase('interaction')
    await page().waitForFunction(() => window.isRootMounted)
    expect(await page().evaluate(() => window.isHydrated)).toBe(false)
    await click('button')
    await page().waitForFunction(() => window.isHydrated)
    // should replay event
    expect(await text('button')).toBe('1')
    await assertHydrationSuccess('2')
  })

  test('interaction (fragment)', async () => {
    await goToCase('interaction', '?fragment')
    await page().waitForFunction(() => window.isRootMounted)
    expect(await page().evaluate(() => window.isHydrated)).toBe(false)
    await click('button')
    await page().waitForFunction(() => window.isHydrated)
    // should replay event
    expect(await text('button')).toBe('1')
    await assertHydrationSuccess('2')
  })

  test('custom', async () => {
    await goToCase('custom')
    await page().waitForFunction(() => window.isRootMounted)
    expect(await page().evaluate(() => window.isHydrated)).toBe(false)
    await click('#custom-trigger')
    await page().waitForFunction(() => window.isHydrated)
    await assertHydrationSuccess()
  })

  test('custom teardown', async () => {
    await goToCase('custom')
    await page().waitForFunction(() => window.isRootMounted)
    expect(await page().evaluate(() => window.isHydrated)).toBe(false)
    await page().evaluate(() => (window.show.value = false))
    expect(await text('#app')).toBe('off')
    expect(await page().evaluate(() => window.isHydrated)).toBe(false)
    expect(await page().evaluate(() => window.teardownCalled)).toBe(true)
  })
})
