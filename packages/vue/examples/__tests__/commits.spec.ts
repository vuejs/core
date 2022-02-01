import path from 'path'
import { setupPuppeteer, E2E_TIMEOUT } from '../../__tests__/e2eUtils'
import mocks from './commits.mock'

describe('e2e: commits', () => {
  const { page, click, count, text, isChecked } = setupPuppeteer()

  async function testCommits(apiType: 'classic' | 'composition') {
    const baseUrl = `file://${path.resolve(
      __dirname,
      `../${apiType}/commits.html`
    )}`

    // intercept and mock the response to avoid hitting the actual API
    await page().setRequestInterception(true)
    page().on('request', req => {
      const match = req.url().match(/&sha=(.*)$/)
      if (!match) {
        req.continue()
      } else {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(mocks[match[1] as 'main' | 'pnpm'])
        })
      }
    })

    await page().goto(baseUrl)
    await page().waitForSelector('li')
    expect(await count('input')).toBe(2)
    expect(await count('label')).toBe(2)
    expect(await text('label[for="main"]')).toBe('main')
    expect(await text('label[for="pnpm"]')).toBe('pnpm')
    expect(await isChecked('#main')).toBe(true)
    expect(await isChecked('#pnpm')).toBe(false)
    expect(await text('p')).toBe('vuejs/vue@main')
    expect(await count('li')).toBe(3)
    expect(await count('li .commit')).toBe(3)
    expect(await count('li .message')).toBe(3)
    await click('#pnpm')
    expect(await text('p')).toBe('vuejs/vue@pnpm')
    expect(await count('li')).toBe(3)
    expect(await count('li .commit')).toBe(3)
    expect(await count('li .message')).toBe(3)
  }

  test(
    'classic',
    async () => {
      await testCommits('classic')
    },
    E2E_TIMEOUT
  )

  test(
    'composition',
    async () => {
      await testCommits('composition')
    },
    E2E_TIMEOUT
  )
})
