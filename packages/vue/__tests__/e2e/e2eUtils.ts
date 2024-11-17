import puppeteer, {
  type Browser,
  type ClickOptions,
  type Page,
  type PuppeteerLaunchOptions,
} from 'puppeteer'

export const E2E_TIMEOUT: number = 30 * 1000

const puppeteerOptions: PuppeteerLaunchOptions = {
  args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  headless: true,
}

const maxTries = 30
export const timeout = (n: number): Promise<any> =>
  new Promise(r => setTimeout(r, n))

export async function expectByPolling(
  poll: () => Promise<any>,
  expected: string,
): Promise<void> {
  for (let tries = 0; tries < maxTries; tries++) {
    const actual = (await poll()) || ''
    if (actual.indexOf(expected) > -1 || tries === maxTries - 1) {
      expect(actual).toMatch(expected)
      break
    } else {
      await timeout(50)
    }
  }
}

interface PuppeteerUtils {
  page: () => Page
  click(selector: string, options?: ClickOptions): Promise<void>
  count(selector: string): Promise<number>
  text(selector: string): Promise<string | null>
  value(selector: string): Promise<string>
  html(selector: string): Promise<string>
  classList(selector: string): Promise<string[]>
  style(selector: string, property: keyof CSSStyleDeclaration): Promise<any>
  children(selector: string): Promise<any[]>
  isVisible(selector: string): Promise<boolean>
  isChecked(selector: string): Promise<boolean>
  isFocused(selector: string): Promise<boolean>
  setValue(selector: string, value: string): Promise<any>
  typeValue(selector: string, value: string): Promise<any>
  enterValue(selector: string, value: string): Promise<any>
  clearValue(selector: string): Promise<any>
  timeout(time: number): Promise<any>
  nextFrame(): Promise<any>
}

export function setupPuppeteer(args?: string[]): PuppeteerUtils {
  let browser: Browser
  let page: Page

  const resolvedOptions = args
    ? {
        ...puppeteerOptions,
        args: [...puppeteerOptions.args!, ...args],
      }
    : puppeteerOptions

  beforeAll(async () => {
    browser = await puppeteer.launch(resolvedOptions)
  }, 20000)

  beforeEach(async () => {
    page = await browser.newPage()

    await page.evaluateOnNewDocument(() => {
      localStorage.clear()
    })

    page.on('console', e => {
      if (e.type() === 'error') {
        const err = e.args()[0]
        console.error(`Error from Puppeteer-loaded page:\n`, err.remoteObject())
      }
    })
  })

  afterEach(async () => {
    await page.close()
  })

  afterAll(async () => {
    await browser.close()
  })

  async function click(
    selector: string,
    options?: ClickOptions,
  ): Promise<void> {
    await page.click(selector, options)
  }

  async function count(selector: string): Promise<number> {
    return (await page.$$(selector)).length
  }

  async function text(selector: string): Promise<string | null> {
    return page.$eval(selector, node => node.textContent)
  }

  async function value(selector: string): Promise<string> {
    return page.$eval(selector, node => (node as HTMLInputElement).value)
  }

  async function html(selector: string): Promise<string> {
    return page.$eval(selector, node => node.innerHTML)
  }

  async function classList(selector: string): Promise<string[]> {
    return page.$eval(selector, (node: any) => [...node.classList])
  }

  async function children(selector: string): Promise<any[]> {
    return page.$eval(selector, (node: any) => [...node.children])
  }

  async function style(
    selector: string,
    property: keyof CSSStyleDeclaration,
  ): Promise<any> {
    return await page.$eval(
      selector,
      (node, property) => {
        return window.getComputedStyle(node)[property]
      },
      property,
    )
  }

  async function isVisible(selector: string): Promise<boolean> {
    const display = await page.$eval(selector, node => {
      return window.getComputedStyle(node).display
    })
    return display !== 'none'
  }

  async function isChecked(selector: string) {
    return await page.$eval(
      selector,
      node => (node as HTMLInputElement).checked,
    )
  }

  async function isFocused(selector: string) {
    return await page.$eval(selector, node => node === document.activeElement)
  }

  async function setValue(selector: string, value: string) {
    await page.$eval(
      selector,
      (node, value) => {
        ;(node as HTMLInputElement).value = value as string
        node.dispatchEvent(new Event('input'))
      },
      value,
    )
  }

  async function typeValue(selector: string, value: string) {
    const el = (await page.$(selector))!
    await el.evaluate(node => ((node as HTMLInputElement).value = ''))
    await el.type(value)
  }

  async function enterValue(selector: string, value: string) {
    const el = (await page.$(selector))!
    await el.evaluate(node => ((node as HTMLInputElement).value = ''))
    await el.type(value)
    await el.press('Enter')
  }

  async function clearValue(selector: string) {
    return await page.$eval(
      selector,
      node => ((node as HTMLInputElement).value = ''),
    )
  }

  function timeout(time: number) {
    return page.evaluate(time => {
      return new Promise(r => {
        setTimeout(r, time)
      })
    }, time)
  }

  function nextFrame() {
    return page.evaluate(() => {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve)
        })
      })
    })
  }

  return {
    page: () => page,
    click,
    count,
    text,
    value,
    html,
    classList,
    style,
    children,
    isVisible,
    isChecked,
    isFocused,
    setValue,
    typeValue,
    enterValue,
    clearValue,
    timeout,
    nextFrame,
  }
}
