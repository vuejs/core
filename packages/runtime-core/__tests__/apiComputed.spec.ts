import {
  computed,
  getCurrentInstance,
  h,
  nodeOps,
  render,
} from '@vue/runtime-test'

describe('api: computed', () => {
  test('should warn if getCurrentInstance is called inside computed getter', () => {
    const Comp = {
      setup() {
        const c = computed(() => {
          getCurrentInstance()
          return 1
        })
        return () => c.value
      },
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(
      'getCurrentInstance() called inside a computed getter',
    ).toHaveBeenWarned()
  })

  test('should warn if getCurrentInstance is called inside computed getter (object syntax)', () => {
    const Comp = {
      setup() {
        const c = computed({
          get: () => {
            getCurrentInstance()
            return 1
          },
          set: () => {},
        })
        return () => c.value
      },
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(
      'getCurrentInstance() called inside a computed getter',
    ).toHaveBeenWarned()
  })
})
