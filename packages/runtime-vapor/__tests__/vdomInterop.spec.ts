import { h } from 'vue'
import { createSlot, defineVaporComponent, template } from '../src'
import { makeInteropRender } from './_utils'

const define = makeInteropRender()

describe('vdomInterop', () => {
  describe('slots', () => {
    test('should render slot fallback if no slot content is provided', () => {
      const VaporChild = defineVaporComponent({
        setup() {
          const n0 = createSlot('default', null, () => {
            const n2 = template('<div>hi</div>')()
            return n2
          })
          return n0
        },
      })

      const { html } = define({
        setup() {
          return () => h(VaporChild as any)
        },
      }).render()

      expect(html()).toBe('<div>hi</div>')
    })
  })
})
