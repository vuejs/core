import type { SetupContext } from '../src/component'
import {
  createComponent,
  defineComponent,
  ref,
  template,
  useAttrs,
  useSlots,
} from '../src'
import { makeRender } from './_utils'

const define = makeRender<any>()

describe('SFC <script setup> helpers', () => {
  test.todo('should warn runtime usage', () => {})

  test('useSlots / useAttrs (no args)', () => {
    let slots: SetupContext['slots'] | undefined
    let attrs: SetupContext['attrs'] | undefined

    const Comp = {
      setup() {
        slots = useSlots()
        attrs = useAttrs()
      },
    }
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
    let slots: SetupContext['slots'] | undefined
    let attrs: SetupContext['attrs'] | undefined
    let ctx: SetupContext | undefined
    const Comp = defineComponent({
      setup(_, _ctx) {
        slots = useSlots()
        attrs = useAttrs()
        ctx = _ctx
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
