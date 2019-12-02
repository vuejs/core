import path from 'path'
import puppeteer from 'puppeteer'

const puppeteerOptions = process.env.CI
  ? { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  : {}

let browser: puppeteer.Browser
let page: puppeteer.Page

describe('e2e', () => {
  beforeEach(async () => {
    browser = await puppeteer.launch(puppeteerOptions)
    page = await browser.newPage()
  })

  afterEach(async () => {
    await browser.close()
  })

  test('todomvc', async () => {
    await page.goto(
      `file://${path.resolve(__dirname, '../classic/todomvc.html')}`
    )
    expect(await isVisible('.main')).toBe(false)
    expect(await isVisible('.footer')).toBe(false)
    expect(await count('.filters .selected')).toBe(1)
    expect(await text('.filters .selected')).toBe('All')
    expect(await count('.todo')).toBe(0)

    await createNewItem('test')
    expect(await count('.todo')).toBe(1)
    expect(await isVisible('.todo .edit')).toBe(false)
    expect(await text('.todo label')).toBe('test')
    expect(await text('.todo-count strong')).toBe('1')
    expect(await isChecked('.todo .toggle')).toBe(false)
    expect(await isVisible('.main')).toBe(true)
    expect(await isVisible('.footer')).toBe(true)
    expect(await isVisible('.clear-completed')).toBe(false)
    expect(await value('.new-todo')).toBe('')

    await createNewItem('test2')
    expect(await count('.todo')).toBe(2)
    expect(await text('.todo:nth-child(2) label')).toBe('test2')
    expect(await text('.todo-count strong')).toBe('2')

    // TODO complete the test
    // https://github.com/vuejs/vue/blob/dev/test/e2e/specs/todomvc.js
  })
})

async function isVisible(selector: string) {
  const display = await page.$eval(selector, (node: HTMLElement) => {
    return window.getComputedStyle(node).display
  })
  return display !== 'none'
}

async function isChecked(selector: string) {
  return await page.$eval(selector, (node: any) => node.checked)
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

async function createNewItem(text: string) {
  const el = (await page.$('.new-todo'))!
  await el.type(text)
  await el.press('Enter')
}
