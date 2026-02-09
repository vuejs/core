import { describe, expect, it } from 'vitest'
import { Fragment, type VNode, h, unwrapFragment } from '../src/index'

describe('unwrapFragment', () => {
  it('returns empty array if input is undefined or empty', () => {
    expect(unwrapFragment(undefined)).toEqual([])
    expect(unwrapFragment([])).toEqual([])
  })

  it('returns same array if no Fragment present', () => {
    const vnode1 = h('div')
    const vnode2 = h('span')
    const input = [vnode1, vnode2]
    const result = unwrapFragment(input)
    expect(result).toEqual(input)
  })

  it('unwraps single level Fragment', () => {
    const children = [h('div', 'a'), h('div', 'b')]
    const fragmentVNode: VNode = h(Fragment, null, children)
    const input = [fragmentVNode]
    const result = unwrapFragment(input)
    expect(result).toHaveLength(2)
    expect(result).toEqual(children)
  })

  it('unwraps nested Fragments recursively', () => {
    const innerChildren = [h('span', 'x'), h('span', 'y')]
    const innerFragment = h(Fragment, null, innerChildren)
    const outerChildren = [innerFragment, h('div', 'z')]
    const outerFragment = h(Fragment, null, outerChildren)
    const input = [outerFragment]
    const result = unwrapFragment(input)
    // Should flatten all fragments recursively
    expect(result).toHaveLength(3)
    expect(result).toEqual([...innerChildren, outerChildren[1]])
  })

  it('unwraps mixed array with Fragment and non-Fragment vnode', () => {
    const children = [h('li', 'item1'), h('li', 'item2')]
    const fragmentVNode = h(Fragment, null, children)
    const nonFragmentVNode = h('p', 'paragraph')
    const input = [fragmentVNode, nonFragmentVNode]
    const result = unwrapFragment(input)
    expect(result).toHaveLength(3)
    expect(result).toEqual([...children, nonFragmentVNode])
  })
})
