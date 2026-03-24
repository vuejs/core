import { type Locator, page, userEvent } from 'vitest/browser'

export const css = (css: string) => page.getByCSS(css)
export const html = (selector: string) => css(selector).element().innerHTML
export const E2E_TIMEOUT: number = 10 * 1000

const duration = 50
export function timeout(time: number) {
  return new Promise(r => {
    setTimeout(r, time)
  })
}

export const transitionFinish = (time = duration) => timeout(time)

export function waitForInnerHTML(
  selector: string,
  expected: string,
  timeoutMs = 1000,
) {
  const container = css(selector).element()
  const getHTML = () => container.innerHTML

  if (getHTML().includes(expected)) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      observer.disconnect()
    }

    const check = () => {
      if (getHTML().includes(expected)) {
        cleanup()
        resolve()
      }
    }

    const observer = new MutationObserver(check)
    const timer = setTimeout(() => {
      const actual = getHTML()
      cleanup()
      reject(
        new Error(
          `Timed out waiting for innerHTML to contain ${expected} in ${selector}.\nReceived: ${actual}`,
        ),
      )
    }, timeoutMs)

    observer.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    })
  })
}

export const nextFrame = () =>
  new Promise(resolve => {
    requestAnimationFrame(resolve)
  })

export const click = (selector: string) => {
  ;(css(selector).element() as HTMLButtonElement).click()
}

export async function enterValue(locator: Locator, text: string) {
  await locator.fill(text)
  await userEvent.type(locator, '{enter}')
}
