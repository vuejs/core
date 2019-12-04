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

    // toggle
    await page.click('.todo .toggle')
    expect(await count('.todo.completed')).toBe(1)
    expect(await classList('.todo:nth-child(1)')).toContain('completed')
    expect(await text('.todo-count strong')).toBe('1')
    expect(await isVisible('.clear-completed')).toBe(true)

    await createNewItem('test3')
    expect(await count('.todo')).toBe(3)
    expect(await text('.todo:nth-child(3) label')).toBe('test3')
    expect(await text('.todo-count strong')).toBe('2')

    await createNewItem('test4')
    await createNewItem('test5')
    expect(await count('.todo')).toBe(5)
    expect(await text('.todo-count strong')).toBe('4')

    // toggle more
    await page.click('.todo:nth-child(4) .toggle')
    await page.click('.todo:nth-child(5) .toggle')
    expect(await count('.todo.completed')).toBe(3)
    expect(await text('.todo-count strong')).toBe('2')

    // remove
    await removeItemAt(1)
    expect(await count('.todo')).toBe(4)
    expect(await count('.todo.completed')).toBe(2)
    expect(await text('.todo-count strong')).toBe('2')
    await removeItemAt(2)
    expect(await count('.todo')).toBe(3)
    expect(await count('.todo.completed')).toBe(2)
    expect(await text('.todo-count strong')).toBe('1')

    // remove all
    await page.click('.clear-completed')
    expect(await count('.todo')).toBe(1)
    expect(await text('.todo label')).toBe('test2')
    expect(await count('.todo.completed')).toBe(0)
    expect(await text('.todo-count strong')).toBe('1')
    expect(await isVisible('.clear-completed')).toBe(false)

    // prepare to test filters
    await createNewItem('test')
    await createNewItem('test')
    await page.click('.todo:nth-child(2) .toggle')
    await page.click('.todo:nth-child(3) .toggle')

    // active filter
    await page.click('.filters li:nth-child(2) a')
    expect(await count('.todo')).toBe(1)
    expect(await count('.todo.completed')).toBe(0)
    // add item with filter active
    await createNewItem('test')
    expect(await count('.todo')).toBe(2)

    // completed filter
    await page.click('.filters li:nth-child(3) a')
    expect(await count('.todo')).toBe(2)
    expect(await count('.todo.completed')).toBe(2)

    // filter on page load
    await page.goto(
      `file://${path.resolve(__dirname, '../classic/todomvc.html#active')}`
    )
    expect(await count('.todo')).toBe(2)
    expect(await count('.todo.completed')).toBe(0)
    expect(await text('.todo-count strong')).toBe('2')

    // completed on page load
    await page.goto(
      `file://${path.resolve(__dirname, '../classic/todomvc.html#completed')}`
    )
    expect(await count('.todo')).toBe(2)
    expect(await count('.todo.completed')).toBe(2)
    expect(await text('.todo-count strong')).toBe('2')

    // toggling with filter active
    await page.click('.todo .toggle')
    expect(await count('.todo')).toBe(1)
    await page.click('.filters li:nth-child(2) a')
    expect(await count('.todo')).toBe(3)
    await page.click('.todo .toggle')
    expect(await count('.todo')).toBe(2)

    // editing triggered by blur
    await page.click('.filters li:nth-child(1) a')
    await page.click('.todo:nth-child(1) label', { clickCount: 2 })
    expect(await count('.todo.editing')).toBe(1)
    expect(await isFocused('.todo:nth-child(1) .edit')).toBe(true)
    await clearValue('.todo:nth-child(1) .edit')
    await page.type('.todo:nth-child(1) .edit', 'edited!')
    await page.click('.new-todo') // blur
    expect(await count('.todo.editing')).toBe(0)
    expect(await text('.todo:nth-child(1) label')).toBe('edited!')

    // editing triggered by enter
    await page.click('.todo label', { clickCount: 2 })
    await enterValue('.todo:nth-child(1) .edit', 'edited again!')
    expect(await count('.todo.editing')).toBe(0)
    expect(await text('.todo:nth-child(1) label')).toBe('edited again!')

    // cancel
    await page.click('.todo label', { clickCount: 2 })
    await clearValue('.todo:nth-child(1) .edit')
    await page.type('.todo:nth-child(1) .edit', 'edited!')
    await page.keyboard.press('Escape')
    expect(await count('.todo.editing')).toBe(0)
    expect(await text('.todo:nth-child(1) label')).toBe('edited again!')

    // empty value should remove
    await page.click('.todo label', { clickCount: 2 })
    await enterValue('.todo:nth-child(1) .edit', ' ')
    expect(await count('.todo')).toBe(3)

    // toggle all
    await page.click('.toggle-all+label')
    expect(await count('.todo.completed')).toBe(3)
    await page.click('.toggle-all+label')
    expect(await count('.todo:not(.completed)')).toBe(3)
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

async function classList(selector: string) {
  return await page.$eval(selector, (node: any) => [...node.classList])
}

async function isFocused(selector: string) {
  return await page.$eval(selector, node => node === document.activeElement)
}

async function clearValue(selector: string) {
  return await page.$eval(selector, (node: any) => (node.value = ''))
}

async function enterValue(selector: string, value: string) {
  const el = (await page.$(selector))!
  await el.evaluate((node: any) => (node.value = ''))
  await el.type(value)
  await el.press('Enter')
}

async function createNewItem(text: string) {
  const el = (await page.$('.new-todo'))!
  await el.type(text)
  await el.press('Enter')
}

async function removeItemAt(n: number) {
  const item = (await page.$('.todo:nth-child(' + n + ')'))!
  const itemBBox = (await item.boundingBox())!
  await page.mouse.move(itemBBox.x + 10, itemBBox.y + 10)
  await page.click('.todo:nth-child(' + n + ') .destroy')
}
