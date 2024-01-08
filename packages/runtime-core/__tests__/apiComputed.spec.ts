import {
  computed,
  createApp,
  getCurrentInstance,
  h,
  inject,
  nodeOps,
  onMounted,
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

  test('should warn if inject is called inside computed getter', () => {
    const Comp = {
      setup() {
        const c = computed(() => {
          inject('foo', 'bar')
          return 1
        })
        c.value
        return () => ''
      },
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect('inject() called inside a computed getter').toHaveBeenWarned()
  })

  test('should not warn if inject is called inside computed getter with appContext', () => {
    const el = nodeOps.createElement('div')
    const app = createApp({
      setup() {
        const c = computed(() => {
          let ret = null
          app.runWithContext(() => {
            ret = inject('foo')
          })
          return ret
        })
        return () => c.value
      },
    })
    app.provide('foo', 'bar').mount(el)
    expect((el.children[0] as any)?.text).toBe('bar')
  })

  test('should warn if a lifecycle hook is called inside computed getter', () => {
    const Comp = {
      setup() {
        const c = computed(() => {
          onMounted(() => {})
          return 1
        })
        c.value
        return () => ''
      },
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect('onMounted() called inside a computed getter').toHaveBeenWarned()
  })
})
