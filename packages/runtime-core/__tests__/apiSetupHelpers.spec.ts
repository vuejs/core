import {
  ComponentInternalInstance,
  defineComponent,
  getCurrentInstance,
  h,
  nodeOps,
  onMounted,
  render,
  SetupContext,
  Suspense
} from '@vue/runtime-test'
import {
  defineEmits,
  defineProps,
  defineExpose,
  withDefaults,
  useAttrs,
  useSlots,
  mergeDefaults,
  withAsyncContext
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

  test('withAsyncContext', async () => {
    const spy = jest.fn()

    let beforeInstance: ComponentInternalInstance | null = null
    let afterInstance: ComponentInternalInstance | null = null
    let resolve: (msg: string) => void

    const Comp = defineComponent({
      async setup() {
        beforeInstance = getCurrentInstance()
        const msg = await withAsyncContext(
          new Promise(r => {
            resolve = r
          })
        )
        // register the lifecycle after an await statement
        onMounted(spy)
        afterInstance = getCurrentInstance()
        return () => msg
      }
    })

    const root = nodeOps.createElement('div')
    render(h(() => h(Suspense, () => h(Comp))), root)

    expect(spy).not.toHaveBeenCalled()
    resolve!('hello')
    // wait a macro task tick for all micro ticks to resolve
    await new Promise(r => setTimeout(r))
    // mount hook should have been called
    expect(spy).toHaveBeenCalled()
    // should retain same instance before/after the await call
    expect(beforeInstance).toBe(afterInstance)
  })
})
