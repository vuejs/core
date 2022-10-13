import { ShapeFlags } from '@vue/shared'
import Vue from '@vue/compat'
import { createComponentInstance } from '../../runtime-core/src/component'
import { setCurrentRenderingInstance } from '../../runtime-core/src/componentRenderContext'
import { DirectiveBinding } from '../../runtime-core/src/directives'
import { createVNode } from '../../runtime-core/src/vnode'
import {
  deprecationData,
  DeprecationTypes,
  toggleDeprecationWarning
} from '../../runtime-core/src/compat/compatConfig'
import { compatH as h } from '../../runtime-core/src/compat/renderFn'

beforeEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({
    MODE: 2,
    GLOBAL_MOUNT: 'suppress-warning'
  })
})

afterEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 3 })
})

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

  test('staticClass + class', () => {
    expect(
      h('div', {
        class: { foo: true },
        staticClass: 'bar'
      })
    ).toMatchObject({
      props: {
        class: 'bar foo'
      }
    })
  })

  test('staticStyle + style', () => {
    expect(
      h('div', {
        style: { color: 'red' },
        staticStyle: { fontSize: '14px' }
      })
    ).toMatchObject({
      props: {
        style: {
          color: 'red',
          fontSize: '14px'
        }
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
        onClick: fn,
        onClickNative: fn,
        onFooBar: fn,
        'onBar-bazNative': fn
      }
    })
  })

  test('v2 legacy event prefixes', () => {
    const fn = () => {}
    expect(
      h('div', {
        on: {
          '&click': fn,
          '~keyup': fn,
          '!touchend': fn
        }
      })
    ).toMatchObject({
      props: {
        onClickPassive: fn,
        onKeyupOnce: fn,
        onTouchendCapture: fn
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

  test('in component usage', () => {
    toggleDeprecationWarning(true)

    const vm = new Vue({
      render(h: any) {
        return h(
          'div',
          {
            class: 'foo',
            attrs: { id: 'bar' }
          },
          'hello'
        )
      }
    }).$mount()

    expect(vm.$el.outerHTML).toBe(`<div class="foo" id="bar">hello</div>`)
    expect(
      deprecationData[DeprecationTypes.RENDER_FUNCTION].message
    ).toHaveBeenWarned()
  })

  test('should detect v3 compiled render fn', () => {
    const vm = new Vue({
      data() {
        return {
          a: 'hello'
        }
      },
      // check is arg length based
      render(c: any, _c: any) {
        return createVNode('div', null, c.a)
      }
    }).$mount()
    expect(vm.$el.outerHTML).toBe(`<div>hello</div>`)
  })
  test('convert extends render Fn', () => {
    const BaseComponent = {
      render: (h: any) => h('div', null, ['hello'])
    }
    const ExtendComponent = {
      extends: BaseComponent
    }
    const vm = new Vue({
      components: { ExtendComponent },
      render(h: any) {
        return h('extend-component', null, [])
      }
    }).$mount()
    expect(vm.$el.outerHTML).toBe(`<div>hello</div>`)
  })
})
