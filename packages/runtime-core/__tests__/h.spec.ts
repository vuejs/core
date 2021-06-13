import { h } from '../src/h'
import { createVNode } from '../src/vnode'
import { RawSlots } from '../src/componentSlots'

// Since h is a thin layer on top of createVNode, we are only testing its
// own logic here. Details of vnode creation is tested in vnode.spec.ts.
describe('renderer: h', () => {
  test('type only', () => {
    expect(h('div')).toMatchObject(createVNode('div'))
  })

  test('type + props', () => {
    expect(h('div', { id: 'foo' })).toMatchObject(
      createVNode('div', { id: 'foo' })
    )
  })

  test('type + omit props', () => {
    // array
    expect(h('div', ['foo'])).toMatchObject(createVNode('div', null, ['foo']))
    // default slot
    const Component = { template: '<br />' }
    const slot = () => {}
    expect(h(Component, slot)).toMatchObject(createVNode(Component, null, slot))
    // single vnode
    const vnode = h('div')
    expect(h('div', vnode)).toMatchObject(createVNode('div', null, [vnode]))
    // text
    expect(h('div', 'foo')).toMatchObject(createVNode('div', null, 'foo'))
  })

  test('type + props + children', () => {
    // array
    expect(h('div', {}, ['foo'])).toMatchObject(createVNode('div', {}, ['foo']))
    // slots
    const slots = {} as RawSlots
    expect(h('div', {}, slots)).toMatchObject(createVNode('div', {}, slots))
    const Component = { template: '<br />' }
    expect(h(Component, {}, slots)).toMatchObject(
      createVNode(Component, {}, slots)
    )
    // default slot
    const slot = () => {}
    expect(h(Component, {}, slot)).toMatchObject(
      createVNode(Component, {}, slot)
    )
    // single vnode
    const vnode = h('div')
    expect(h('div', {}, vnode)).toMatchObject(createVNode('div', {}, [vnode]))
    // text
    expect(h('div', {}, 'foo')).toMatchObject(createVNode('div', {}, 'foo'))
  })

  test('named slots with null props', () => {
    const Component = { template: '<br />' }
    const slot = () => {}
    expect(
      h(Component, null, {
        foo: slot
      })
    ).toMatchObject(
      createVNode(Component, null, {
        foo: slot
      })
    )
  })

  // for simple JSX compat
  // note this signature is not supported in types; it's purely for usage with
  // compiled code.
  test('support variadic children', () => {
    // @ts-ignore
    const vnode = h('div', null, h('span'), h('span'))
    expect(vnode.children).toMatchObject([
      {
        type: 'span'
      },
      {
        type: 'span'
      }
    ])
  })
})
