import { createVNode } from '@vue/runtime-test'

describe('vnode', () => {
  test('create with just tag', () => {
    const vnode = createVNode('p')
    expect(vnode.type).toBe('p')
    expect(vnode.props).toBe(null)
  });

  test('create with tag and props', () => {
    const vnode = createVNode('p', {})
    expect(vnode.type).toBe('p')
    expect(vnode.props).toMatchObject({})
  })

  test('create with tag, props and children', () => {
    const vnode = createVNode('p', {}, ['foo'])
    expect(vnode.type).toBe('p')
    expect(vnode.props).toMatchObject({})
    expect(vnode.children).toMatchObject(["foo"])
  })

  test('create with 0 as props', () => {
    const vnode = createVNode('p', null)
    expect(vnode.type).toBe('p')
    expect(vnode.props).toBe(null)
  })

  test('class normalization', () => {
    let vnode = createVNode('p', { class: 'foo baz'})
    expect(vnode.props).toMatchObject({ class: 'foo baz'})

    vnode = createVNode('p', { class: ['foo', 'baz']})
    expect(vnode.props).toMatchObject({ class: 'foo baz'})

    vnode = createVNode('p', { class: {foo: 'foo', baz: 'baz'}})
    expect(vnode.props).toMatchObject({ class: 'foo baz'})
  })

  test('style normalization', () => {
    let vnode = createVNode('p', { style: [{ foo: 'foo'}, { baz: 'baz'}]})
    expect(vnode.props).toMatchObject({ style: { foo: 'foo', baz: 'baz'}})

    vnode = createVNode('p', { style: {foo: 'foo', baz: 'baz'}})
    expect(vnode.props).toMatchObject({ style: { foo: 'foo', baz: 'baz'}})
  })

  test.todo('children normalization')

  test.todo('normalizeVNode')

  test.todo('node type/shapeFlag inference')

  test.todo('cloneVNode')

  test.todo('mergeProps')
})
