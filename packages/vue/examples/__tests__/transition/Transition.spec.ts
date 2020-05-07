import { E2E_TIMEOUT, setupPuppeteer } from '../e2eUtils'
import path from 'path'

function nextFrame(cb: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb)
  })
}

describe('e2e: Transition', () => {
  const { page, html, click, classList } = setupPuppeteer()
  const baseUrl = `file://${path.resolve(
    __dirname,
    '../../transition/index.html'
  )}`
  const duration = 50,
    buffer = 10
  const container = '#test'

  test(
    'basic transition',
    async () => {
      await page().goto(baseUrl)
      await page().waitFor('#app')
      expect(await html(container)).toBe('<div class="test"></div>')

      await click('button')
      expect(await classList('#test div')).toStrictEqual([
        'test',
        'v-leave-active',
        'v-leave-from'
      ])
      await new Promise((resolve, reject) => {
        nextFrame(async () => {
          expect(await classList('#test div')).toStrictEqual([
            'test',
            'v-leave-active',
            'v-leave-to'
          ])
          setTimeout(async () => {
            expect(await html('#test')).toBe('<!--v-if-->')
            resolve()
          }, duration + buffer)
        })
      })

      await click('button')
      expect(await classList('#test div')).toStrictEqual([
        'test',
        'v-enter-active',
        'v-enter-from'
      ])
      await new Promise((resolve, reject) => {
        nextFrame(async () => {
          expect(await classList('#test div')).toStrictEqual([
            'test',
            'v-enter-active',
            'v-enter-to'
          ])
          setTimeout(async () => {
            expect(await html('#test')).toBe('<div class="test"></div>')
            resolve()
          }, duration + buffer)
        })
      })
    },
    E2E_TIMEOUT
  )
})
