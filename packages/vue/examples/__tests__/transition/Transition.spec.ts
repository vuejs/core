import { E2E_TIMEOUT, setupPuppeteer } from '../e2eUtils'
import path from 'path'

describe('e2e: Transition', () => {
  const { page, html, classList } = setupPuppeteer()
  const baseUrl = `file://${path.resolve(
    __dirname,
    '../../transition/index.html'
  )}`

  const container = '#test'

  const duration = 50
  const buffer = 10
  const transitionFinish = () =>
    new Promise(r => {
      setTimeout(r, duration + buffer)
    })

  const nextFrame = () => {
    return page().evaluate(() => {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve)
        })
      })
    })
  }

  test(
    'basic transition',
    async () => {
      await page().goto(baseUrl)
      await page().waitFor('#app')
      expect(await html(container)).toBe('<div class="test">content</div>')

      const leaveStartClasses = await page().evaluate(() => {
        document.querySelector('button')!.click()
        return Promise.resolve().then(() => {
          return document.querySelector('#test div')!.className.split(/\s+/g)
        })
      })

      expect(leaveStartClasses).toStrictEqual([
        'test',
        'v-leave-active',
        'v-leave-from'
      ])

      await nextFrame()
      expect(await classList('#test div')).toStrictEqual([
        'test',
        'v-leave-active',
        'v-leave-to'
      ])

      await transitionFinish()
      expect(await html('#test')).toBe('<!--v-if-->')

      const enterStartClasses = await page().evaluate(() => {
        document.querySelector('button')!.click()
        return Promise.resolve().then(() => {
          return document.querySelector('#test div')!.className.split(/\s+/g)
        })
      })

      expect(enterStartClasses).toStrictEqual([
        'test',
        'v-enter-active',
        'v-enter-from'
      ])

      await nextFrame()
      expect(await classList('#test div')).toStrictEqual([
        'test',
        'v-enter-active',
        'v-enter-to'
      ])

      await transitionFinish()
      expect(await html('#test')).toBe('<div class="test">content</div>')
    },
    E2E_TIMEOUT
  )
})
