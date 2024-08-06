import { once } from 'node:events'
import { createServer } from 'node:http'
import path from 'node:path'
import { beforeAll } from 'vitest'
import serveHandler from 'serve-handler'

import { E2E_TIMEOUT, setupPuppeteer } from './e2eUtils'

// use the `vue` package root as the public directory
// because we need to serve the Vue runtime for the tests
const serverRoot = path.resolve(import.meta.dirname, '../../')
const testPort = 9090
const basePath = path.relative(
  serverRoot,
  path.resolve(import.meta.dirname, './trusted-types.html'),
)
const baseUrl = `http://localhost:${testPort}/${basePath}`

const { page, html } = setupPuppeteer()

let server: ReturnType<typeof createServer>
beforeAll(async () => {
  // sets up the static server
  server = createServer((req, res) => {
    return serveHandler(req, res, {
      public: serverRoot,
      cleanUrls: false,
    })
  })

  server.listen(testPort)
  await once(server, 'listening')
})

afterAll(async () => {
  server.close()
  await once(server, 'close')
})

describe('e2e: trusted types', () => {
  beforeEach(async () => {
    await page().goto(baseUrl)
    await page().waitForSelector('#app')
  })

  test(
    'should render the hello world app',
    async () => {
      await page().evaluate(() => {
        const { createApp, ref, h } = (window as any).Vue
        createApp({
          setup() {
            const msg = ref('✅success: hello world')
            return function render() {
              return h('div', msg.value)
            }
          },
        }).mount('#app')
      })
      expect(await html('#app')).toContain('<div>✅success: hello world</div>')
    },
    E2E_TIMEOUT,
  )

  test(
    'should render static vnode without error',
    async () => {
      await page().evaluate(() => {
        const { createApp, createStaticVNode } = (window as any).Vue
        createApp({
          render() {
            return createStaticVNode('<div>✅success: static vnode</div>')
          },
        }).mount('#app')
      })
      expect(await html('#app')).toContain('<div>✅success: static vnode</div>')
    },
    E2E_TIMEOUT,
  )

  test(
    'should accept v-html with custom policy',
    async () => {
      await page().evaluate(() => {
        const testPolicy = (window as any).trustedTypes.createPolicy('test', {
          createHTML: (input: string): string => input,
        })

        const { createApp, ref, h } = (window as any).Vue
        createApp({
          setup() {
            const msg = ref('✅success: v-html')
            return function render() {
              return h('div', { innerHTML: testPolicy.createHTML(msg.value) })
            }
          },
        }).mount('#app')
      })
      expect(await html('#app')).toContain('<div>✅success: v-html</div>')
    },
    E2E_TIMEOUT,
  )
})
