import { shallowRef } from '@vue/reactivity'
import {
  insert,
  insertFragment,
  insertNode,
  normalizeBlock,
  remove,
  removeFragment,
  removeNode,
} from '../src/block'
import {
  DynamicFragment,
  ForBlock,
  ForFragment,
  SlotFragment,
  VaporFragment,
  isDynamicFragment,
  isForBlock,
  isForFragment,
  isFragment,
  isInteropFragment,
  isSlotFragment,
} from '../src/fragment'
import { DYNAMIC } from '../src/fragmentFlags'
import { TeleportFragment } from '../src/components/Teleport'
import { isTeleportFragment } from '../src/teleport'

const node1 = document.createTextNode('node1')
const node2 = document.createTextNode('node2')
const node3 = document.createTextNode('node3')
const anchor = document.createTextNode('anchor')

describe('block + node ops', () => {
  test('normalizeBlock', () => {
    expect(normalizeBlock([node1, node2, node3])).toEqual([node1, node2, node3])
    expect(normalizeBlock([node1, [node2, [node3]]])).toEqual([
      node1,
      node2,
      node3,
    ])
    const frag = new VaporFragment(node2)
    frag.anchor = anchor
    expect(normalizeBlock([node1, frag, [node3]])).toEqual([
      node1,
      node2,
      anchor,
      node3,
    ])
  })

  test('insert', () => {
    const container = document.createElement('div')
    insert([anchor], container)
    insert([node1], container)
    insert([node2], container, anchor)
    insert([], container, node3)
    expect(Array.from(container.childNodes)).toEqual([node2, anchor, node1])

    // self-insert is a guarded no-op: fragment anchors travel inside
    // frag.nodes (ForFragment, interop fragments) and re-insert with the
    // anchor as the target
    container.appendChild(node3)
    insert(node3, container, node3)
    expect(Array.from(container.childNodes)).toEqual([
      node2,
      anchor,
      node1,
      node3,
    ])
    node3.remove()
  })

  test('single node helpers', () => {
    const container = document.createElement('div')
    const localAnchor = document.createTextNode('anchor')
    const localNode1 = document.createTextNode('node1')
    const localNode2 = document.createTextNode('node2')

    insertNode(localAnchor, container)
    insertNode(localNode1, container)
    insertNode(localNode2, container, localAnchor)
    expect(Array.from(container.childNodes)).toEqual([
      localNode2,
      localAnchor,
      localNode1,
    ])

    removeNode(localNode2, container)
    expect(Array.from(container.childNodes)).toEqual([localAnchor, localNode1])
  })

  test('fragment helper', () => {
    const container = document.createElement('div')
    const localAnchor = document.createTextNode('anchor')
    const fragmentAnchor = document.createTextNode('fragment anchor')
    const localNode = document.createTextNode('node')
    const frag = new VaporFragment(localNode)
    frag.anchor = fragmentAnchor

    insertNode(localAnchor, container)
    insertFragment(frag, container, localAnchor)
    expect(Array.from(container.childNodes)).toEqual([
      localNode,
      fragmentAnchor,
      localAnchor,
    ])
  })

  test('fragment remove helper', () => {
    const container = document.createElement('div')
    const localNode = document.createTextNode('node')
    const fragmentAnchor = document.createTextNode('fragment anchor')
    const frag = new VaporFragment(localNode)
    frag.anchor = fragmentAnchor
    frag.remove = parent => {
      parent!.removeChild(localNode)
    }

    container.append(localNode, fragmentAnchor)
    removeFragment(frag, container)
    expect(Array.from(container.childNodes)).toEqual([])
  })

  test('remove', () => {
    const container = document.createElement('div')
    container.append(node1, node2, node3)
    const frag = new VaporFragment(node3)
    remove([node1], container)
    remove(frag, container)
    expect(Array.from(container.childNodes)).toEqual([node2])

    expect(() => remove(anchor, container)).toThrowError(
      'The node to be removed is not a child of this node.',
    )
  })
})

describe('fragment protocol flags', () => {
  test('identify constructor-owned roles without class or shape checks', () => {
    const fragment = new VaporFragment(node1)
    const dynamic = new DynamicFragment(DYNAMIC, undefined, false, false)
    const slot = new SlotFragment()
    const forFragment = new ForFragment([], false)
    const forBlock = new ForBlock(
      node2,
      undefined,
      shallowRef(0),
      undefined,
      undefined,
      0,
    )
    const teleport = new TeleportFragment({ to: document.body })

    for (const value of [
      fragment,
      dynamic,
      slot,
      forFragment,
      forBlock,
      teleport,
    ]) {
      expect(isFragment(value)).toBe(true)
    }
    expect(isDynamicFragment(dynamic)).toBe(true)
    expect(isSlotFragment(slot)).toBe(true)
    expect(isForFragment(forFragment)).toBe(true)
    expect(isForBlock(forBlock)).toBe(true)
    expect(isTeleportFragment(teleport)).toBe(true)

    expect(isSlotFragment(dynamic)).toBe(false)
    expect(isDynamicFragment(fragment)).toBe(false)
    expect(isForFragment(forBlock)).toBe(false)
    expect(isForBlock(forFragment)).toBe(false)
    expect(isInteropFragment(fragment)).toBe(false)
  })
})
