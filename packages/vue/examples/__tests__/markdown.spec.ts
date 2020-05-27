import path from 'path'
import { setupPuppeteer, E2E_TIMEOUT } from './e2eUtils'

describe('e2e: markdown', () => {
  const { page, isVisible, value, html } = setupPuppeteer()

  async function testMarkdown(apiType: 'classic' | 'composition') {
    const baseUrl = `file://${path.resolve(
      __dirname,
      `../${apiType}/markdown.html#test`
    )}`

    await page().goto(baseUrl)
    expect(await isVisible('#editor')).toBe(true)
    expect(await value('textarea')).toBe('# hello')
    expect(await html('#editor div')).toBe('<h1 id="hello">hello</h1>\n')

    await page().type('textarea', '\n## foo\n\n- bar\n- baz')
    // assert the output is not updated yet because of debounce
    expect(await html('#editor div')).toBe('<h1 id="hello">hello</h1>\n')
    await page().waitFor(100)
    expect(await html('#editor div')).toBe(
      '<h1 id="hello">hello</h1>\n' +
        '<h2 id="foo">foo</h2>\n' +
        '<ul>\n<li>bar</li>\n<li>baz</li>\n</ul>\n'
    )
  }

  test(
    'classic',
    async () => {
      await testMarkdown('classic')
    },
    E2E_TIMEOUT
  )

  test(
    'composition',
    async () => {
      await testMarkdown('composition')
    },
    E2E_TIMEOUT
  )
})
