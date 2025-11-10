import { ref } from '@vue/reactivity'
import { makeRender } from './_utils'
import { createFor } from '../src'
import { nextTick } from '@vue/runtime-dom'

const define = makeRender()

describe('api: createSelector', () => {
  test('basic', async () => {
    let calledTimes = 0
    let expectedCalledTimes = 0

    const list = ref([{ id: 0 }, { id: 1 }, { id: 2 }])
    const index = ref(0)

    const { host } = define(() => {
      let selector: (cb: () => void) => void
      return createFor(
        () => list.value,
        item => {
          const span = document.createElement('li')
          selector(() => {
            calledTimes += 1
            const { id } = item.value
            span.textContent = `${id}.${id === index.value ? 't' : 'f'}`
          })
          return span
        },
        item => item.id,
        undefined,
        ({ createSelector }) => {
          selector = createSelector(() => index.value)
        },
      )
    }).render()

    expect(host.innerHTML).toBe(
      '<li>0.t</li><li>1.f</li><li>2.f</li><!--for-->',
    )
    expect(calledTimes).toBe((expectedCalledTimes += 3))

    index.value = 1
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0.f</li><li>1.t</li><li>2.f</li><!--for-->',
    )
    expect(calledTimes).toBe((expectedCalledTimes += 2))

    index.value = 2
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0.f</li><li>1.f</li><li>2.t</li><!--for-->',
    )
    expect(calledTimes).toBe((expectedCalledTimes += 2))

    // list.value[2].id = 3
    // await nextTick()
    // expect(host.innerHTML).toBe(
    //   '<li>0.f</li><li>1.f</li><li>3.f</li><!--for-->',
    // )
    // expect(calledTimes).toBe((expectedCalledTimes += 1))
  })
})
