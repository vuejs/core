import {
  computed,
  createFor,
  createTextNode,
  nextTick,
  ref,
  renderEffect,
  setText,
} from '../src'
import { makeRender } from './_utils'

const define = makeRender()

describe('createFor', () => {
  test('basic', async () => {
    const list = ref([{ name: '1' }, { name: '2' }, { name: '3' }])
    const sort = ref(false)
    const sortedList = computed(() =>
      sort.value ? Array.from(list.value).reverse() : list.value,
    )

    const { host } = define(() => {
      const n1 = createFor(
        () => sortedList.value,
        block => {
          const n3 = createTextNode()
          renderEffect(() => {
            const [item] = block.s
            setText(n3, item.name)
          })
          return [n3]
        },
      )
      return [n1]
    }).render()

    expect(host.innerHTML).toBe('123<!--for-->')

    // add
    list.value.push({ name: '4' })
    await nextTick()
    expect(host.innerHTML).toBe('1234<!--for-->')

    // move
    sort.value = true
    await nextTick()
    expect(host.innerHTML).toBe('4321<!--for-->')
    sort.value = false
    await nextTick()
    expect(host.innerHTML).toBe('1234<!--for-->')

    // change
    list.value[0].name = 'a'
    await nextTick()
    expect(host.innerHTML).toBe('a234<!--for-->')

    // remove
    list.value = []
    await nextTick()
    expect(host.innerHTML).toBe('<!--for-->')
  })
})
