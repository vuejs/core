import { type Locator, page, userEvent } from 'vitest/browser'

export const css = (css: string) => page.getByCSS(css)
export const E2E_TIMEOUT: number = 30 * 1000

export async function enterValue(locator: Locator, text: string) {
  await locator.fill(text)
  await userEvent.type(locator, '{enter}')
}

export function nextFrame() {
  // this page is not same as Playwright's page
  // how to wait for the next frame?
  return page.evaluate(() => {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    })
  })
}
