import { createComponent, defineVaporComponent, template } from '../src'
import { ref, useAttrs, useSlots } from '@vue/runtime-dom'
import { makeRender } from './_utils'
import type { VaporComponentInstance } from '../src/component'

const define = makeRender<any>()

describe('SFC <script setup> helpers', () => {
  test('useSlots / useAttrs (no args)', () => {
    let slots: VaporComponentInstance['slots'] | undefined
    let attrs: VaporComponentInstance['attrs'] | undefined

    const Comp = defineVaporComponent({
      setup() {
        // @ts-expect-error
        slots = useSlots()
        attrs = useAttrs()
        return []
      },
    })
    const count = ref(0)
    const passedAttrs = { id: () => count.value }
    const passedSlots = {
      default: () => template('')(),
      x: () => template('')(),
    }

    const { render } = define({
      render: () => createComponent(Comp, passedAttrs, passedSlots),
    })
    render()

    expect(typeof slots!.default).toBe('function')
    expect(typeof slots!.x).toBe('function')
    expect(attrs).toMatchObject({ id: 0 })

    count.value++
    expect(attrs).toMatchObject({ id: 1 })
  })

  test('useSlots / useAttrs (with args)', () => {
    let slots: VaporComponentInstance['slots'] | undefined
    let attrs: VaporComponentInstance['attrs'] | undefined
    let ctx: VaporComponentInstance | undefined
    const Comp = defineVaporComponent({
      setup(_, _ctx) {
        // @ts-expect-error
        slots = useSlots()
        attrs = useAttrs()
        ctx = _ctx as VaporComponentInstance
        return []
      },
    })
    const { render } = define({ render: () => createComponent(Comp) })
    render()
    expect(slots).toBe(ctx!.slots)
    expect(attrs).toBe(ctx!.attrs)
  })
})
