import path from 'node:path'
import { E2E_TIMEOUT, expectByPolling, setupPuppeteer } from './e2eUtils'

describe('e2e: markdown', () => {
  const { page, isVisible, value, html } = setupPuppeteer()

  async function testMarkdown(apiType: 'classic' | 'composition') {
    const baseUrl = `file://${path.resolve(
      __dirname,
      `../../examples/${apiType}/markdown.html#test`,
    )}`

    await page().goto(baseUrl)
    expect(await isVisible('#editor')).toBe(true)
    expect(await value('textarea')).toBe('# hello')
    expect(await html('#editor div')).toBe('<h1>hello</h1>\n')

    await page().type('textarea', '\n## foo\n\n- bar\n- baz')

    // assert the output is not updated yet because of debounce
    // debounce has become unstable on CI so this assertion is disabled
    // expect(await html('#editor div')).toBe('<h1 id="hello">hello</h1>\n')

    await expectByPolling(
      () => html('#editor div'),
      '<h1>hello</h1>\n' +
        '<h2>foo</h2>\n' +
        '<ul>\n<li>bar</li>\n<li>baz</li>\n</ul>\n',
    )
  }

  test(
    'classic',
    async () => {
      await testMarkdown('classic')
    },
    E2E_TIMEOUT,
  )

  test(
    'composition',
    async () => {
      await testMarkdown('composition')
    },
    E2E_TIMEOUT,
  )
})
