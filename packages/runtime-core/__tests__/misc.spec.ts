import { render, h, nodeOps, reactive, isReactive } from '@vue/runtime-test'

describe('misc', () => {
  test('component public instance should not be observable', () => {
    let instance: any
    const Comp = {
      render() {},
      mounted() {
        instance = this
      }
    }
    render(h(Comp), nodeOps.createElement('div'))
    expect(instance).toBeDefined()
    const r = reactive(instance)
    expect(r).toBe(instance)
    expect(isReactive(r)).toBe(false)
  })
})
