import { createComponent, defineVaporComponent, template } from '../src'
import { ref, useAttrs, useSlots } from '@vue/runtime-dom'
import { makeRender } from './_utils'
import type { VaporComponentInstance } from '../src/component'

const define = makeRender<any>()

describe.todo('SFC <script setup> helpers', () => {
  test.todo('should warn runtime usage', () => {})

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

  describe.todo('mergeDefaults', () => {
    test.todo('object syntax', () => {})
    test.todo('array syntax', () => {})
    test.todo('merging with skipFactory', () => {})
    test.todo('should warn missing', () => {})
  })

  describe('mergeModels', () => {
    test.todo('array syntax', () => {})
    test.todo('object syntax', () => {})
    test.todo('overwrite', () => {})
  })

  test.todo('createPropsRestProxy', () => {})

  describe.todo('withAsyncContext', () => {
    test.todo('basic', async () => {})
    test.todo('error handling', async () => {})
    test.todo('should not leak instance on multiple awaits', async () => {})
    test.todo('should not leak on multiple awaits + error', async () => {})
    test.todo('race conditions', async () => {})
    test.todo('should teardown in-scope effects', async () => {})
  })
})
