import path from 'node:path'
import { setupPuppeteer } from './e2eUtils'

declare const window: Window & { isHydrated: boolean; isRootMounted: boolean }

describe('async component hydration strategies', () => {
  const { page, click, text, count } = setupPuppeteer(['--window-size=800,600'])

  async function goToCase(name: string, query = '') {
    const file = `file://${path.resolve(__dirname, `./hydration-strat-${name}.html${query}`)}`
    await page().goto(file)
  }

  async function assertHydrationSuccess() {
    await click('button')
    expect(await text('button')).toBe('1')
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

  test('media query', async () => {})

  test('interaction', async () => {})

  test('interaction (fragment)', async () => {})
})
