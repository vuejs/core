import { createBuffer, unrollBuffer } from '../src'

describe('SSR buffer helpers', () => {
  test('creates and unrolls nested buffers', async () => {
    const parent = createBuffer()
    const child = createBuffer()

    parent.push('<div>')
    child.push('<span>')
    child.push('hello')
    child.push('</span>')
    parent.push(child.getBuffer())
    parent.push(Promise.resolve(['async']))
    parent.push('</div>')

    expect(await unrollBuffer(parent.getBuffer())).toBe(
      '<div><span>hello</span>async</div>',
    )
  })
})
