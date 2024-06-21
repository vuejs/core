import { isReactive, reactive } from 'vue'
import { makeRender } from './_utils'

const define = makeRender()

describe('misc', () => {
  test.fails('component public instance should not be observable', () => {
    const { instance } = define({}).render()
    expect(instance).toBeDefined()
    const r = reactive(instance!)
    expect(r).toBe(instance)
    expect(isReactive(r)).toBe(false)
  })
})
