import { toString, h, render, nodeOps, serialize } from '@vue/runtime-test'

describe('toString', () => {
  it('should convert plain object to string', () => {
    const root = nodeOps.createElement('div')

    render(h('div', [toString({ a: 'b' })]), root)
    expect(serialize(root)).toBe(`<div><div>{
  "a": "b"
}</div></div>`)
  })
  it('should return VNode', () => {
    const root = nodeOps.createElement('div')

    render(h('div', [toString(h('div', { id: 'a' }))]), root)
    expect(serialize(root)).toBe(`<div><div><div id="a"></div></div></div>`)
  })
})
