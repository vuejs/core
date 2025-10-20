import path from 'node:path'
import {
  E2E_TIMEOUT,
  setupPuppeteer,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import connect from 'connect'
import sirv from 'sirv'
const { page, html, click, value, enterValue } = setupPuppeteer()

describe('vapor keepalive', () => {
  let server: any
  const port = '8197'
  beforeAll(() => {
    server = connect()
      .use(sirv(path.resolve(import.meta.dirname, '../dist')))
      .listen(port)
    process.on('SIGTERM', () => server && server.close())
  })

  beforeEach(async () => {
    const baseUrl = `http://localhost:${port}/keepalive/`
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
  })

  afterAll(() => {
    server.close()
  })

  test(
    'render vdom component',
    async () => {
      const testSelector = '.render-vdom-component'
      const btnShow = `${testSelector} .btn-show`
      const btnToggle = `${testSelector} .btn-toggle`
      const container = `${testSelector} > div`
      const inputSelector = `${testSelector} input`

      let calls = await page().evaluate(() => {
        return (window as any).getCalls()
      })
      expect(calls).toStrictEqual(['mounted', 'activated'])

      expect(await html(container)).toBe('<input type="text">')
      expect(await value(inputSelector)).toBe('vdom')

      // change input value
      await enterValue(inputSelector, 'changed')
      expect(await value(inputSelector)).toBe('changed')

      // deactivate
      await click(btnToggle)
      expect(await html(container)).toBe('')
      calls = await page().evaluate(() => {
        return (window as any).getCalls()
      })
      expect(calls).toStrictEqual(['deactivated'])

      // activate
      await click(btnToggle)
      expect(await html(container)).toBe('<input type="text">')
      expect(await value(inputSelector)).toBe('changed')
      calls = await page().evaluate(() => {
        return (window as any).getCalls()
      })
      expect(calls).toStrictEqual(['activated'])

      // unmount keepalive
      await click(btnShow)
      expect(await html(container)).toBe('')
      calls = await page().evaluate(() => {
        return (window as any).getCalls()
      })
      expect(calls).toStrictEqual(['deactivated', 'unmounted'])

      // mount keepalive
      await click(btnShow)
      expect(await html(container)).toBe('<input type="text">')
      expect(await value(inputSelector)).toBe('vdom')
      calls = await page().evaluate(() => {
        return (window as any).getCalls()
      })
      expect(calls).toStrictEqual(['mounted', 'activated'])
    },
    E2E_TIMEOUT,
  )
})
