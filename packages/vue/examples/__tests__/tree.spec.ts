import path from 'path'
import { setupPuppeteer, E2E_TIMEOUT } from '../../__tests__/e2eUtils'

describe('e2e: tree', () => {
  const { page, click, count, text, children, isVisible } = setupPuppeteer()

  async function testTree(apiType: 'classic' | 'composition') {
    const baseUrl = `file://${path.resolve(
      __dirname,
      `../${apiType}/tree.html`
    )}`

    await page().goto(baseUrl)
    expect(await count('.item')).toBe(12)
    expect(await count('.add')).toBe(4)
    expect(await count('.item > ul')).toBe(4)
    expect(await isVisible('#demo li ul')).toBe(false)
    expect(await text('#demo li div span')).toBe('[+]')

    // expand root
    await click('.bold')
    expect(await isVisible('#demo ul')).toBe(true)
    expect((await children('#demo li ul')).length).toBe(4)
    expect(await text('#demo li div span')).toContain('[-]')
    expect(await text('#demo > .item > ul > .item:nth-child(1)')).toContain(
      'hello'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(2)')).toContain(
      'wat'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(3)')).toContain(
      'child folder'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(3)')).toContain(
      '[+]'
    )

    // add items to root
    await click('#demo > .item > ul > .add')
    expect((await children('#demo li ul')).length).toBe(5)
    expect(await text('#demo > .item > ul > .item:nth-child(1)')).toContain(
      'hello'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(2)')).toContain(
      'wat'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(3)')).toContain(
      'child folder'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(3)')).toContain(
      '[+]'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(4)')).toContain(
      'new stuff'
    )

    // add another item
    await click('#demo > .item > ul > .add')
    expect((await children('#demo li ul')).length).toBe(6)
    expect(await text('#demo > .item > ul > .item:nth-child(1)')).toContain(
      'hello'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(2)')).toContain(
      'wat'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(3)')).toContain(
      'child folder'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(3)')).toContain(
      '[+]'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(4)')).toContain(
      'new stuff'
    )
    expect(await text('#demo > .item > ul > .item:nth-child(5)')).toContain(
      'new stuff'
    )

    await click('#demo ul .bold')
    expect(await isVisible('#demo ul ul')).toBe(true)
    expect(await text('#demo ul > .item:nth-child(3)')).toContain('[-]')
    expect((await children('#demo ul ul')).length).toBe(5)

    await click('.bold')
    expect(await isVisible('#demo ul')).toBe(false)
    expect(await text('#demo li div span')).toContain('[+]')
    await click('.bold')
    expect(await isVisible('#demo ul')).toBe(true)
    expect(await text('#demo li div span')).toContain('[-]')

    await click('#demo ul > .item div', { clickCount: 2 })
    expect(await count('.item')).toBe(15)
    expect(await count('.item > ul')).toBe(5)
    expect(await text('#demo ul > .item:nth-child(1)')).toContain('[-]')
    expect((await children('#demo ul > .item:nth-child(1) > ul')).length).toBe(
      2
    )
  }

  test(
    'classic',
    async () => {
      await testTree('classic')
    },
    E2E_TIMEOUT
  )

  test(
    'composition',
    async () => {
      await testTree('composition')
    },
    E2E_TIMEOUT
  )
})
