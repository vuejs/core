import path from 'node:path'
import {
  E2E_TIMEOUT,
  setupPuppeteer,
} from '../../../packages/vue/__tests__/e2e/e2eUtils'
import connect from 'connect'
import sirv from 'sirv'
import { nextTick } from 'vue'
import { ports } from '../utils'
const { page, click, html } = setupPuppeteer()

describe('vdom / vapor interop', () => {
  let server: any
  const port = ports.teleport
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
    const baseUrl = `http://localhost:${port}/teleport/`
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
  })

  describe('vapor teleport', () => {
    test(
      'render vdom component',
      async () => {
        const targetSelector = '.target'
        const testSelector = '.interop-render-vdom-comp'
        const containerSelector = `${testSelector} > div`
        const btnSelector = `${testSelector} > button`

        // teleport is disabled
        expect(await html(containerSelector)).toBe('<h1>vdom comp</h1>')
        expect(await html(targetSelector)).toBe('')

        // enable teleport
        await click(btnSelector)
        await nextTick()

        expect(await html(containerSelector)).toBe('')
        expect(await html(targetSelector)).toBe('<h1>vdom comp</h1>')

        // disable teleport
        await click(btnSelector)
        await nextTick()
        expect(await html(containerSelector)).toBe('<h1>vdom comp</h1>')
        expect(await html(targetSelector)).toBe('')
      },
      E2E_TIMEOUT,
    )
  })
})
