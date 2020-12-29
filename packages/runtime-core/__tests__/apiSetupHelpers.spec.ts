import {
  defineComponent,
  h,
  nodeOps,
  render,
  SetupContext
} from '@vue/runtime-test'
import { defineEmit, defineProps, useContext } from '../src/apiSetupHelpers'

describe('SFC <script setup> helpers', () => {
  test('should warn runtime usage', () => {
    defineProps()
    expect(`defineProps() is a compiler-hint`).toHaveBeenWarned()

    defineEmit()
    expect(`defineEmit() is a compiler-hint`).toHaveBeenWarned()
  })

  test('useContext (no args)', () => {
    let ctx: SetupContext | undefined
    const Comp = {
      setup() {
        ctx = useContext()
        return () => {}
      }
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(ctx).toMatchObject({
      attrs: {},
      slots: {}
    })
    expect(typeof ctx!.emit).toBe('function')
  })

  test('useContext (with args)', () => {
    let ctx: SetupContext | undefined
    let ctxArg: SetupContext | undefined
    const Comp = defineComponent({
      setup(_, _ctxArg) {
        ctx = useContext()
        ctxArg = _ctxArg
        return () => {}
      }
    })
    render(h(Comp), nodeOps.createElement('div'))
    expect(ctx).toBeDefined()
    expect(ctx).toBe(ctxArg)
  })
})
