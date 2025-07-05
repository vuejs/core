import { defineComponent, h } from '@vue/runtime-dom'
import { makeInteropRender } from './_utils'
import { createComponent, defineVaporComponent } from '../src'

const define = makeInteropRender()

describe('vdomInterop', () => {
  describe.todo('props', () => {})

  describe.todo('emit', () => {})

  describe.todo('slots', () => {})

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
