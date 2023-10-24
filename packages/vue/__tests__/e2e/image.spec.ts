import path from 'path'
import { E2E_TIMEOUT, setupPuppeteer } from './e2eUtils'

describe('e2e: image', () => {
  const { page } = setupPuppeteer()

  const baseUrl = `file://${path.resolve(
    __dirname,
    `../../examples/classic/image.html`
  )}`

  test(
    'lazy load',
    async () => {
      await page().setRequestInterception(true)
      page().on('request', interceptedRequest => {
        const url = interceptedRequest.url()
        interceptedRequest.continue()
        expect(url.includes('lazyload.jpg')).toBe(false)
      })
      await page().goto(baseUrl)
      await page().waitForSelector('#app')
    },
    E2E_TIMEOUT
  )
})
