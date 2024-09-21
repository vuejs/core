import { ref } from '@vue/reactivity'
import { makeRender } from './_utils'
import { createFor, createSelector, nextTick, renderEffect } from '../src'

const define = makeRender()

describe('api: createSelector', () => {
  test('basic', async () => {
    let calledTimes = 0
    let expectedCalledTimes = 0

    const list = ref([{ id: 0 }, { id: 1 }, { id: 2 }])
    const index = ref(0)

    const { host } = define(() => {
      const isSleected = createSelector(index)
      return createFor(
        () => list.value,
        ([item]) => {
          const span = document.createElement('li')
          renderEffect(() => {
            calledTimes += 1
            const { id } = item.value
            span.textContent = `${id}.${isSleected(id) ? 't' : 'f'}`
          })
          return span
        },
        item => item.id,
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

    list.value[2].id = 3
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0.f</li><li>1.f</li><li>3.f</li><!--for-->',
    )
    expect(calledTimes).toBe((expectedCalledTimes += 1))
  })

  test('custom compare', async () => {
    let calledTimes = 0
    let expectedCalledTimes = 0

    const list = ref([{ id: 1 }, { id: 2 }, { id: 3 }])
    const index = ref(0)

    const { host } = define(() => {
      const isSleected = createSelector(
        index,
        (key, value) => key === value + 1,
      )
      return createFor(
        () => list.value,
        ([item]) => {
          const span = document.createElement('li')
          renderEffect(() => {
            calledTimes += 1
            const { id } = item.value
            span.textContent = `${id}.${isSleected(id) ? 't' : 'f'}`
          })
          return span
        },
        item => item.id,
      )
    }).render()

    expect(host.innerHTML).toBe(
      '<li>1.t</li><li>2.f</li><li>3.f</li><!--for-->',
    )
    expect(calledTimes).toBe((expectedCalledTimes += 3))

    index.value = 1
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>1.f</li><li>2.t</li><li>3.f</li><!--for-->',
    )
    expect(calledTimes).toBe((expectedCalledTimes += 2))

    index.value = 2
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>1.f</li><li>2.f</li><li>3.t</li><!--for-->',
    )
    expect(calledTimes).toBe((expectedCalledTimes += 2))

    list.value[2].id = 4
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>1.f</li><li>2.f</li><li>4.f</li><!--for-->',
    )
    expect(calledTimes).toBe((expectedCalledTimes += 1))
  })
})
