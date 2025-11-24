import { createComponent, defineVaporComponent, template } from '../src'
import {
  currentInstance,
  onMounted,
  ref,
  useAttrs,
  useSlots,
  withAsyncContext,
} from '@vue/runtime-dom'
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

  describe.todo('withAsyncContext', () => {
    test('basic', async () => {
      const spy = vi.fn()

      let beforeInstance: VaporComponentInstance | null = null
      let afterInstance: VaporComponentInstance | null = null
      let resolve: (msg: string) => void

      const Comp = defineVaporComponent({
        async setup() {
          let __temp: any, __restore: any

          beforeInstance = currentInstance as VaporComponentInstance

          const msg =
            (([__temp, __restore] = withAsyncContext(
              () =>
                new Promise(r => {
                  resolve = r
                }),
            )),
            (__temp = await __temp),
            __restore(),
            __temp)

          // register the lifecycle after an await statement
          onMounted(spy)
          afterInstance = currentInstance as VaporComponentInstance
          return document.createTextNode(msg)
        },
      })

      const { html } = define(Comp).render()

      expect(spy).not.toHaveBeenCalled()
      resolve!('hello')
      // wait a macro task tick for all micro ticks to resolve
      await new Promise(r => setTimeout(r))
      // mount hook should have been called
      expect(spy).toHaveBeenCalled()
      // should retain same instance before/after the await call
      expect(beforeInstance).toBe(afterInstance)
      expect(html()).toBe('hello')
    })

    test.todo('error handling', async () => {})
    test.todo('should not leak instance on multiple awaits', async () => {})
    test.todo('should not leak on multiple awaits + error', async () => {})
    test.todo('race conditions', async () => {})
    test.todo('should teardown in-scope effects', async () => {})
  })
})
