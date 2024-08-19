import path from 'node:path'
import { setupPuppeteer } from './e2eUtils'

const { page, click, text } = setupPuppeteer()

// this must be tested in actual Chrome because jsdom does not support
// declarative shadow DOM
test('ssr custom element hydration', async () => {
  await page().goto(
    `file://${path.resolve(__dirname, './ssr-custom-element.html')}`,
  )

  function getColor() {
    return page().evaluate(() => {
      return [
        (document.querySelector('my-element') as any).style.border,
        (document.querySelector('my-element-async') as any).style.border,
      ]
    })
  }

  expect(await getColor()).toMatchObject(['1px solid red', ''])
  await page().evaluate(() => (window as any).resolve()) // exposed by test
  expect(await getColor()).toMatchObject(['1px solid red', '1px solid red'])

  async function assertInteraction(el: string) {
    const selector = `${el} >>> button`
    expect(await text(selector)).toBe('1')
    await click(selector)
    expect(await text(selector)).toBe('2')
  }

  await assertInteraction('my-element')
  await assertInteraction('my-element-async')
})
