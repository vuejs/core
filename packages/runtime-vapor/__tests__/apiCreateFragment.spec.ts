import { nextTick, ref } from 'vue'
import { createKeyedFragment, template } from '../src'
import { makeRender } from './_utils'

const define = makeRender()

describe('api: createKeyedFragment', () => {
  test('basic', async () => {
    const key = ref(0)
    const { host } = define({
      setup() {
        return createKeyedFragment(
          () => key.value,
          () => {
            const n0 = template(`<div>Item 0</div>`)() as any
            n0.$key = key.value
            return n0
          },
        )
      },
    }).render()

    expect(host.children.length).toBe(1)
    expect((host.children[0] as any).$key).toBe(0)

    key.value = 1
    await nextTick()
    expect((host.children[0] as any).$key).toBe(1)
  })
})
