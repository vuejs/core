import { createVNode } from '@vue/runtime-test'
import {
  ShapeFlags,
  Comment,
  Fragment,
  Text,
  cloneVNode
} from '@vue/runtime-core'
import { mergeProps, normalizeVNode } from '../src/vnode'
import { Data } from '../src/component'

describe('vnode', () => {
  test('create with just tag', () => {
    const vnode = createVNode('p')
    expect(vnode.type).toBe('p')
    expect(vnode.props).toBe(null)
  })

  test('create with tag and props', () => {
    const vnode = createVNode('p', {})
    expect(vnode.type).toBe('p')
    expect(vnode.props).toMatchObject({})
  })

  test('create with tag, props and children', () => {
    const vnode = createVNode('p', {}, ['foo'])
    expect(vnode.type).toBe('p')
    expect(vnode.props).toMatchObject({})
    expect(vnode.children).toMatchObject(['foo'])
  })

  test('create with 0 as props', () => {
    const vnode = createVNode('p', null)
    expect(vnode.type).toBe('p')
    expect(vnode.props).toBe(null)
  })

  describe('class normalization', () => {
    test('string', () => {
      const vnode = createVNode('p', { class: 'foo baz' })
      expect(vnode.props).toMatchObject({ class: 'foo baz' })
    })

    test('array<string>', () => {
      const vnode = createVNode('p', { class: ['foo', 'baz'] })
      expect(vnode.props).toMatchObject({ class: 'foo baz' })
    })

    test('array<object>', () => {
      const vnode = createVNode('p', {
        class: [{ foo: 'foo' }, { baz: 'baz' }]
      })
      expect(vnode.props).toMatchObject({ class: 'foo baz' })
    })

    test('object', () => {
      const vnode = createVNode('p', { class: { foo: 'foo', baz: 'baz' } })
      expect(vnode.props).toMatchObject({ class: 'foo baz' })
    })
  })

  describe('style normalization', () => {
    test('array', () => {
      const vnode = createVNode('p', {
        style: [{ foo: 'foo' }, { baz: 'baz' }]
      })
      expect(vnode.props).toMatchObject({ style: { foo: 'foo', baz: 'baz' } })
    })

    test('object', () => {
      const vnode = createVNode('p', { style: { foo: 'foo', baz: 'baz' } })
      expect(vnode.props).toMatchObject({ style: { foo: 'foo', baz: 'baz' } })
    })
  })

  describe('children normalization', () => {
    const nop = jest.fn

    test('null', () => {
      const vnode = createVNode('p', null, null)
      expect(vnode.children).toBe(null)
      expect(vnode.shapeFlag).toBe(ShapeFlags.ELEMENT)
    })

    test('array', () => {
      const vnode = createVNode('p', null, ['foo'])
      expect(vnode.children).toMatchObject(['foo'])
      expect(vnode.shapeFlag).toBe(
        ShapeFlags.ELEMENT + ShapeFlags.ARRAY_CHILDREN
      )
    })

    test('object', () => {
      const vnode = createVNode('p', null, { foo: 'foo' })
      expect(vnode.children).toMatchObject({ foo: 'foo' })
      expect(vnode.shapeFlag).toBe(
        ShapeFlags.ELEMENT + ShapeFlags.SLOTS_CHILDREN
      )
    })

    test('function', () => {
      const vnode = createVNode('p', null, nop)
      expect(vnode.children).toMatchObject({ default: nop })
      expect(vnode.shapeFlag).toBe(
        ShapeFlags.ELEMENT + ShapeFlags.SLOTS_CHILDREN
      )
    })

    test('string', () => {
      const vnode = createVNode('p', null, 'foo')
      expect(vnode.children).toBe('foo')
      expect(vnode.shapeFlag).toBe(
        ShapeFlags.ELEMENT + ShapeFlags.TEXT_CHILDREN
      )
    })
  })

  test('normalizeVNode', () => {
    // null / undefined -> Comment
    expect(normalizeVNode(null)).toMatchObject({ type: Comment })
    expect(normalizeVNode(undefined)).toMatchObject({ type: Comment })

    // array -> Fragment
    expect(normalizeVNode(['foo'])).toMatchObject({ type: Fragment })

    // VNode -> VNode
    const vnode = createVNode('div')
    expect(normalizeVNode(vnode)).toBe(vnode)

    // mounted VNode -> cloned VNode
    const mounted = createVNode('div')
    mounted.el = {}
    const normalized = normalizeVNode(mounted)
    expect(normalized).not.toBe(mounted)
    expect(normalized).toEqual(mounted)

    // primitive types
    expect(normalizeVNode('foo')).toMatchObject({ type: Text, children: `foo` })
    expect(normalizeVNode(1)).toMatchObject({ type: Text, children: `1` })
    expect(normalizeVNode(true)).toMatchObject({ type: Text, children: `true` })
  })

  test('type shapeFlag inference', () => {
    expect(createVNode('div').shapeFlag).toBe(ShapeFlags.ELEMENT)
    expect(createVNode({}).shapeFlag).toBe(ShapeFlags.STATEFUL_COMPONENT)
    expect(createVNode(() => {}).shapeFlag).toBe(
      ShapeFlags.FUNCTIONAL_COMPONENT
    )
    expect(createVNode(Text).shapeFlag).toBe(0)
  })

  test('cloneVNode', () => {
    const node1 = createVNode('div', { foo: 1 }, null)
    expect(cloneVNode(node1)).toEqual(node1)

    const node2 = createVNode({}, null, [node1])
    const cloned2 = cloneVNode(node2)
    expect(cloned2).toEqual(node2)
    expect(cloneVNode(node2)).toEqual(node2)
    expect(cloneVNode(node2)).toEqual(cloned2)
  })

  describe('mergeProps', () => {
    test('class', () => {
      let props1: Data = { class: 'c' }
      let props2: Data = { class: ['cc'] }
      let props3: Data = { class: [{ ccc: true }] }
      let props4: Data = { class: { cccc: true } }
      expect(mergeProps(props1, props2, props3, props4)).toMatchObject({
        class: 'c cc ccc cccc'
      })
    })

    test('style', () => {
      let props1: Data = {
        style: {
          color: 'red',
          fontSize: 10
        }
      }
      let props2: Data = {
        style: [
          {
            color: 'blue',
            width: '200px'
          },
          {
            width: '300px',
            height: '300px',
            fontSize: 30
          }
        ]
      }
      expect(mergeProps(props1, props2)).toMatchObject({
        style: {
          color: 'blue',
          width: '300px',
          height: '300px',
          fontSize: 30
        }
      })
    })

    test('handlers', () => {
      let clickHander1 = function() {}
      let clickHander2 = function() {}
      let focusHander2 = function() {}

      let props1: Data = { onClick: clickHander1 }
      let props2: Data = { onClick: clickHander2, onFocus: focusHander2 }
      expect(mergeProps(props1, props2)).toMatchObject({
        onClick: [clickHander1, clickHander2],
        onFocus: focusHander2
      })
    })

    test('default', () => {
      let props1: Data = { foo: 'c' }
      let props2: Data = { foo: {}, bar: ['cc'] }
      let props3: Data = { baz: { ccc: true } }
      expect(mergeProps(props1, props2, props3)).toMatchObject({
        foo: {},
        bar: ['cc'],
        baz: { ccc: true }
      })
    })
  })
})
