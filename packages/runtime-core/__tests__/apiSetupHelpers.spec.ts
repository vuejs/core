import {
  defineComponent,
  h,
  nodeOps,
  render,
  SetupContext
} from '@vue/runtime-test'
import {
  defineEmits,
  defineProps,
  defineExpose,
  withDefaults,
  useAttrs,
  useSlots,
  mergeDefaults
} from '../src/apiSetupHelpers'

describe('SFC <script setup> helpers', () => {
  test('should warn runtime usage', () => {
    defineProps()
    expect(`defineProps() is a compiler-hint`).toHaveBeenWarned()

    defineEmits()
    expect(`defineEmits() is a compiler-hint`).toHaveBeenWarned()

    defineExpose()
    expect(`defineExpose() is a compiler-hint`).toHaveBeenWarned()

    withDefaults({}, {})
    expect(`withDefaults() is a compiler-hint`).toHaveBeenWarned()
  })

  test('useSlots / useAttrs (no args)', () => {
    let slots: SetupContext['slots'] | undefined
    let attrs: SetupContext['attrs'] | undefined
    const Comp = {
      setup() {
        slots = useSlots()
        attrs = useAttrs()
        return () => {}
      }
    }
    const passedAttrs = { id: 'foo' }
    const passedSlots = {
      default: () => {},
      x: () => {}
    }
    render(h(Comp, passedAttrs, passedSlots), nodeOps.createElement('div'))
    expect(typeof slots!.default).toBe('function')
    expect(typeof slots!.x).toBe('function')
    expect(attrs).toMatchObject(passedAttrs)
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
        return () => {}
      }
    })
    render(h(Comp), nodeOps.createElement('div'))
    expect(slots).toBe(ctx!.slots)
    expect(attrs).toBe(ctx!.attrs)
  })

  test('mergeDefaults', () => {
    const merged = mergeDefaults(
      {
        foo: null,
        bar: { type: String, required: false }
      },
      {
        foo: 1,
        bar: 'baz'
      }
    )
    expect(merged).toMatchObject({
      foo: { default: 1 },
      bar: { type: String, required: false, default: 'baz' }
    })

    mergeDefaults({}, { foo: 1 })
    expect(
      `props default key "foo" has no corresponding declaration`
    ).toHaveBeenWarned()
  })
})
