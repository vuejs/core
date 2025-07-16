import { createVNode, defineComponent, h, renderSlot } from '@vue/runtime-dom'
import { makeInteropRender } from './_utils'
import { createComponent, defineVaporComponent } from '../src'

const define = makeInteropRender()

describe('vdomInterop', () => {
  describe('props', () => {
    test('should work if props are not provided', () => {
      const VaporChild = defineVaporComponent({
        props: {
          msg: String,
        },
        setup(_, { attrs }) {
          return [document.createTextNode(attrs.class || 'foo')]
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('foo')
    })
  })

  describe('emit', () => {
    test('emit from vapor child to vdom parent', () => {
      const VaporChild = defineVaporComponent({
        emits: ['click'],
        setup(_, { emit }) {
          emit('click')
          return []
        },
      })

      const fn = vi.fn()
      define({
        setup() {
          return () => h(VaporChild as any, { onClick: fn })
        },
      }).render()

      // fn should be called once
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('slots', () => {
    test('basic', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => renderSlot(slots, 'default')
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: () => document.createTextNode('default slot'),
            },
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('default slot')
    })

    test('functional slot', () => {
      const VDomChild = defineComponent({
        setup(_, { slots }) {
          return () => createVNode(slots.default!)
        },
      })

      const VaporChild = defineVaporComponent({
        setup() {
          return createComponent(
            VDomChild as any,
            null,
            {
              default: () => document.createTextNode('default slot'),
            },
            true,
          )
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('default slot')
    })
  })

  describe.todo('provide', () => {})

  describe.todo('inject', () => {})

  describe.todo('template ref', () => {})

  describe.todo('dynamic component', () => {})

  describe('attribute fallthrough', () => {
    it('should not fallthrough emit handlers to vdom child', () => {
      const VDomChild = defineComponent({
        emits: ['click'],
        setup(_, { emit }) {
          return () => h('button', { onClick: () => emit('click') }, 'click me')
        },
      })

      const fn = vi.fn()
      const VaporChild = defineVaporComponent({
        emits: ['click'],
        setup() {
          return createComponent(
            VDomChild as any,
            { onClick: () => fn },
            null,
            true,
          )
        },
      })

      const { host, html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('<button>click me</button>')
      const button = host.querySelector('button')!
      button.dispatchEvent(new Event('click'))

      // fn should be called once
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})
