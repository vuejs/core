import path from 'node:path'
import { setupPuppeteer } from './e2eUtils'

declare const window: { isHydrated: boolean }

describe('async component hydration strategies', () => {
  const { page, click, text } = setupPuppeteer()

  async function goToCase(name: string) {
    const file = `file://${path.resolve(__dirname, `./hydration-strat-${name}.html`)}`
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
    expect(await page().evaluate(() => window.isHydrated)).toBe(undefined)
    // wait for hydration
    await page().waitForFunction(() => window.isHydrated)
    // assert message order: hyration should happen after already queued main thread work
    expect(messages.slice(1)).toMatchObject(['resolve', 'busy', 'hydrated'])
    await assertHydrationSuccess()
  })

  test('visible', async () => {})

  test('visible (fragment)', async () => {})

  test('media query', async () => {})

  test('interaction', async () => {})

  test('interaction (fragment)', async () => {})
})
