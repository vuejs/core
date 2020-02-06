import path from 'path'
import { setupPuppeteer, E2E_TIMEOUT } from './e2eUtils'

declare const globalStats: {
  label: string
  value: number
}[]

declare function valueToPoint(
  value: number,
  index: number,
  total: number
): {
  x: number
  y: number
}

describe('e2e: svg', () => {
  const { page, click, count, setValue } = setupPuppeteer()

  async function assertStats(total: number) {
    await page().evaluate(
      total => {
        const points = globalStats
          .map((stat, i) => {
            const point = valueToPoint(stat.value, i, total)
            return point.x + ',' + point.y
          })
          .join(' ')
        return document.querySelector('polygon')!.attributes[0].value === points
      },
      [total]
    )
  }

  async function testSvg(apiType: 'classic' | 'composition') {
    const baseUrl = `file://${path.resolve(
      __dirname,
      `../${apiType}/svg.html`
    )}`

    await page().goto(baseUrl)
    await page().waitFor('svg')
    expect(await count('g')).toBe(1)
    expect(await count('polygon')).toBe(1)
    expect(await count('circle')).toBe(1)
    expect(await count('text')).toBe(6)
    expect(await count('label')).toBe(6)
    expect(await count('button')).toBe(7)
    expect(await count('input[type="range"]')).toBe(6)
    await assertStats(6)

    await click('button.remove')
    expect(await count('text')).toBe(5)
    expect(await count('label')).toBe(5)
    expect(await count('button')).toBe(6)
    expect(await count('input[type="range"]')).toBe(5)
    await assertStats(5)

    await setValue('input[name="newlabel"]', 'foo')
    await click('#add > button')
    expect(await count('text')).toBe(6)
    expect(await count('label')).toBe(6)
    expect(await count('button')).toBe(7)
    expect(await count('input[type="range"]')).toBe(6)
    await assertStats(6)
  }

  test(
    'classic',
    async () => {
      await testSvg('classic')
    },
    E2E_TIMEOUT
  )

  test(
    'composition',
    async () => {
      await testSvg('composition')
    },
    E2E_TIMEOUT
  )
})
