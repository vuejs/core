import { h, transformHArgs, resetTransformHArgs } from '../src/h'
import { createVNode } from '../src/vnode'
import { ComponentInternalInstance } from '@vue/runtime-core'
import { createApp } from '@vue/runtime-dom'

// Since h is a thin layer on top of createVNode, we are only testing its
// own logic here. Details of vnode creation is tested in vnode.spec.ts.
const testH = () => {
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
    // default slot
    const Component = { template: '<br />' }
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
}

describe('renderer: h', testH)

describe('renderer: transformHArgs', () => {
  describe('no-op pass-through', () => {
    beforeAll(() => {
      transformHArgs((hArgs: unknown[]) => hArgs)
    })
 
    afterAll(resetTransformHArgs)
 
    testH()
  })

  describe('args is used directly, without merging', () => {
    beforeAll(() => {
      transformHArgs(() => ['h1', 'Hello World'])
    })
 
    afterAll(resetTransformHArgs)
 
    test('nodes become an h1 with text inside', () => {
      expect(h('div')).toMatchObject(createVNode('h1', null, 'Hello World'))
    })

    test('resetting transformHArgs turns things back to normal', () => {
      expect(h('div')).toMatchObject(createVNode('h1', null, 'Hello World'))
      resetTransformHArgs()
      expect(h('div')).toMatchObject(createVNode('div'))
    })
  })

  test('receives component instance as the 2nd arg', () => {
    transformHArgs((_: unknown[], instance: ComponentInternalInstance) => {
      return ['h1', instance.type.name] // <h1>{{ name }}</h1>
    })

    const vm = createApp({
      // this will be the name of the component in the h1
      name: 'Root Component',
      render() {
        return h({
          // this code will never execute,
          // because it is overridden by the transformHArgs method
          render() {
            return h('h2', 'Stub Text')
          }
        })
      }
    })

    // we need to mount everything so that the instance passed to
    // transformHArgs isn't null
    vm.mount('body')

    expect(document.body.outerHTML).toContain('<h1>Root Component</h1>')
  })
})
