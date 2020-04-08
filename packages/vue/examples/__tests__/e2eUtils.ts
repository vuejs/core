import puppeteer from 'puppeteer'

export const E2E_TIMEOUT = 30 * 1000

const puppeteerOptions = process.env.CI
  ? { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  : {}

export function setupPuppeteer() {
  let browser: puppeteer.Browser
  let page: puppeteer.Page

  beforeEach(async () => {
    browser = await puppeteer.launch(puppeteerOptions)
    page = await browser.newPage()

    page.on('console', e => {
      if (e.type() === 'error') {
        const err = e.args()[0] as any
        console.error(
          `Error from Puppeteer-loaded page:\n`,
          err._remoteObject.description
        )
      }
    })
  })

  afterEach(async () => {
    await browser.close()
  })

  async function click(selector: string, options?: puppeteer.ClickOptions) {
    await page.click(selector, options)
  }

  async function count(selector: string) {
    return (await page.$$(selector)).length
  }

  async function text(selector: string) {
    return await page.$eval(selector, node => node.textContent)
  }

  async function value(selector: string) {
    return await page.$eval(selector, node => (node as HTMLInputElement).value)
  }

  async function html(selector: string) {
    return await page.$eval(selector, node => node.innerHTML)
  }

  async function classList(selector: string) {
    return await page.$eval(selector, (node: any) => [...node.classList])
  }

  async function children(selector: string) {
    return await page.$eval(selector, (node: any) => [...node.children])
  }

  async function isVisible(selector: string) {
    const display = await page.$eval(selector, node => {
      return window.getComputedStyle(node).display
    })
    return display !== 'none'
  }

  async function isChecked(selector: string) {
    return await page.$eval(
      selector,
      node => (node as HTMLInputElement).checked
    )
  }

  async function isFocused(selector: string) {
    return await page.$eval(selector, node => node === document.activeElement)
  }

  async function setValue(selector: string, value: string) {
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
      node => ((node as HTMLInputElement).value = '')
    )
  }

  return {
    page: () => page,
    click,
    count,
    text,
    value,
    html,
    classList,
    children,
    isVisible,
    isChecked,
    isFocused,
    setValue,
    enterValue,
    clearValue
  }
}
