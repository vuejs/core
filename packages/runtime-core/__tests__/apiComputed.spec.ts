import {
  type ComputedRef,
  computed,
  getCurrentInstance,
  h,
  nodeOps,
  ref,
  render,
  serializeInner,
} from '@vue/runtime-test'

describe('api: computed', () => {
  test('should ensure currentInstance in computed getter', () => {
    let c: ComputedRef
    const n = ref(0)
    const spy = vi.fn()
    const Comp = {
      setup() {
        c = computed(() => {
          spy()
          return !!getCurrentInstance() ? n.value : n.value + 1
        })
        // access
        c.value
        expect(spy).toHaveBeenCalledTimes(1)
        // should not break currentInstance
        expect(getCurrentInstance()).toBeTruthy()

        return () => {
          return c.value
        }
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(String(n.value))
    expect(spy).toHaveBeenCalledTimes(1)

    // invalidate caching so the getter is evaluated without active instance
    n.value++
    expect(c!.value).toBe(n.value)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
