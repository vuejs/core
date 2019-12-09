import puppeteer from 'puppeteer'

const puppeteerOptions = process.env.CI
  ? { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  : {}

export function setupPuppeteer() {
  let browser: puppeteer.Browser
  let page: puppeteer.Page

  beforeEach(async () => {
    browser = await puppeteer.launch(puppeteerOptions)
    page = await browser.newPage()
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
    return await page.$eval(selector, (node: any) => node.value)
  }

  async function isVisible(selector: string) {
    const display = await page.$eval(selector, (node: HTMLElement) => {
      return window.getComputedStyle(node).display
    })
    return display !== 'none'
  }

  async function isChecked(selector: string) {
    return await page.$eval(selector, (node: any) => node.checked)
  }

  async function classList(selector: string) {
    return await page.$eval(selector, (node: any) => [...node.classList])
  }

  async function isFocused(selector: string) {
    return await page.$eval(selector, node => node === document.activeElement)
  }

  async function enterValue(selector: string, value: string) {
    const el = (await page.$(selector))!
    await el.evaluate((node: any) => (node.value = ''))
    await el.type(value)
    await el.press('Enter')
  }

  async function clearValue(selector: string) {
    return await page.$eval(selector, (node: any) => (node.value = ''))
  }

  return {
    page: () => page,
    click,
    count,
    text,
    value,
    classList,
    isVisible,
    isChecked,
    isFocused,
    enterValue,
    clearValue
  }
}
