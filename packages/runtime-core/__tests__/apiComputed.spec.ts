import {
  computed,
  getCurrentInstance,
  h,
  nodeOps,
  render,
  serializeInner,
} from '@vue/runtime-test'

describe('api: computed', () => {
  test('should ensure currentInstance in computed getter', () => {
    const Comp = {
      setup() {
        const c = computed(() => {
          return !!getCurrentInstance()
        })
        return () => {
          return String(c.value)
        }
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe('true')
  })
})
