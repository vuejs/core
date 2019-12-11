import path from 'path'
import { setupPuppeteer } from './e2eUtils'

describe('e2e: commits', () => {
  const { page, click, count, text, isChecked } = setupPuppeteer()

  async function testCommits(apiType: 'classic' | 'composition') {
    const baseUrl = `file://${path.resolve(
      __dirname,
      `../${apiType}/commits.html#test`
    )}`

    await page().goto(baseUrl)
    await page().waitFor('li')
    expect(await count('input')).toBe(2)
    expect(await count('label')).toBe(2)
    expect(await text('label[for="master"]')).toBe('master')
    expect(await text('label[for="sync"]')).toBe('sync')
    expect(await isChecked('#master')).toBe(true)
    expect(await isChecked('#sync')).toBe(false)
    expect(await text('p')).toBe('vuejs/vue@master')
    expect(await count('li')).toBe(3)
    expect(await count('li .commit')).toBe(3)
    expect(await count('li .message')).toBe(3)
    await click('#sync')
    expect(await text('p')).toBe('vuejs/vue@sync')
    expect(await count('li')).toBe(3)
    expect(await count('li .commit')).toBe(3)
    expect(await count('li .message')).toBe(3)
  }

  test('classic', async () => {
    await testCommits('classic')
  })

  test('composition', async () => {
    await testCommits('composition')
  })
})
