import { ShapeFlags } from '@vue/shared/src'
import { createComponentInstance } from '../../component'
import { setCurrentRenderingInstance } from '../../componentRenderContext'
import { DirectiveBinding } from '../../directives'
import { createVNode } from '../../vnode'
import { compatH as h } from '../renderFn'

describe('compat: render function', () => {
  const mockDir = {}
  const mockChildComp = {}
  const mockComponent = {
    directives: {
      mockDir
    },
    components: {
      foo: mockChildComp
    }
  }
  const mockInstance = createComponentInstance(
    createVNode(mockComponent),
    null,
    null
  )
  beforeEach(() => {
    setCurrentRenderingInstance(mockInstance)
  })
  afterEach(() => {
    setCurrentRenderingInstance(null)
  })

  test('string component lookup', () => {
    expect(h('foo')).toMatchObject({
      type: mockChildComp
    })
  })

  test('class / style / attrs / domProps / props', () => {
    expect(
      h('div', {
        class: 'foo',
        style: { color: 'red' },
        attrs: {
          id: 'foo'
        },
        domProps: {
          innerHTML: 'hi'
        },
        props: {
          myProp: 'foo'
        }
      })
    ).toMatchObject({
      props: {
        class: 'foo',
        style: { color: 'red' },
        id: 'foo',
        innerHTML: 'hi',
        myProp: 'foo'
      }
    })
  })

  test('on / nativeOn', () => {
    const fn = () => {}
    expect(
      h('div', {
        on: {
          click: fn,
          fooBar: fn
        },
        nativeOn: {
          click: fn,
          'bar-baz': fn
        }
      })
    ).toMatchObject({
      props: {
        onClick: fn, // should dedupe
        onFooBar: fn,
        'onBar-baz': fn
      }
    })
  })

  test('directives', () => {
    expect(
      h('div', {
        directives: [
          {
            name: 'mock-dir',
            value: '2',
            // expression: '1 + 1',
            arg: 'foo',
            modifiers: {
              bar: true
            }
          }
        ]
      })
    ).toMatchObject({
      dirs: [
        {
          dir: mockDir,
          instance: mockInstance.proxy,
          value: '2',
          oldValue: void 0,
          arg: 'foo',
          modifiers: {
            bar: true
          }
        }
      ] as DirectiveBinding[]
    })
  })

  test('scopedSlots', () => {
    const scopedSlots = {
      default() {}
    }
    const vnode = h(mockComponent, {
      scopedSlots
    })
    expect(vnode).toMatchObject({
      children: scopedSlots
    })
    expect('scopedSlots' in vnode.props!).toBe(false)
    expect(vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN).toBeTruthy()
  })

  test('legacy named slot', () => {
    const vnode = h(mockComponent, [
      'text',
      h('div', { slot: 'foo' }, 'one'),
      h('div', { slot: 'bar' }, 'two'),
      h('div', { slot: 'foo' }, 'three'),
      h('div', 'four')
    ])
    expect(vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN).toBeTruthy()
    const slots = vnode.children as any

    // default
    expect(slots.default()).toMatchObject(['text', { children: 'four' }])
    expect(slots.foo()).toMatchObject([
      { children: 'one' },
      { children: 'three' }
    ])
    expect(slots.bar()).toMatchObject([{ children: 'two' }])
  })
})
