import { ref } from '@vue/reactivity'
import { makeRender } from './_utils'
import { createFor, createSelector } from '../src'
import { nextTick } from '@vue/runtime-dom'

const define = makeRender()

describe('api: createSelector', () => {
  test('basic', async () => {
    let calledTimes = 0
    let expectedCalledTimes = 0

    const list = ref([{ id: 0 }, { id: 1 }, { id: 2 }])
    const index = ref(0)

    const { host } = define(() => {
      const selector = createSelector(() => index.value)
      return createFor(
        () => list.value,
        item => {
          const span = document.createElement('li')
          selector(item.value.id, () => {
            calledTimes += 1
            const { id } = item.value
            span.textContent = `${id}.${id === index.value ? 't' : 'f'}`
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
  })

  test('selector runs after list updates when value changes first', async () => {
    const items = ref<number[]>([])
    const index = ref(-1)

    const { host } = define(() => {
      const selector = createSelector(() => index.value)
      return createFor(
        () => items.value,
        item => {
          const div = document.createElement('div')
          selector(item.value, () => {
            div.className = index.value === item.value ? 'active' : ''
          })
          const btn = document.createElement('button')
          btn.textContent = String(item.value)
          div.appendChild(btn)
          return div
        },
        item => item,
      )
    }).render()

    expect(host.innerHTML).toBe('<!--for-->')

    index.value = 0
    items.value.push(0)
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div class="active"><button>0</button></div><!--for-->',
    )

    index.value = -1
    await nextTick()
    expect(host.innerHTML).toBe(
      '<div class=""><button>0</button></div><!--for-->',
    )
  })

  test('multiple selectors on one v-for, each tracking its own source', async () => {
    const list = ref([{ id: 0 }, { id: 1 }, { id: 2 }])
    const selA = ref(0)
    const selB = ref(2)

    const { host } = define(() => {
      const sA = createSelector(() => selA.value)
      const sB = createSelector(() => selB.value)
      return createFor(
        () => list.value,
        item => {
          const span = document.createElement('span')
          let a = ''
          let b = ''
          const update = () => (span.textContent = `${item.value.id}:${a},${b}`)
          sA(item.value.id, () => {
            a = item.value.id === selA.value ? 'A' : ''
            update()
          })
          sB(item.value.id, () => {
            b = item.value.id === selB.value ? 'B' : ''
            update()
          })
          return span
        },
        item => item.id,
      )
    }).render()

    expect(host.innerHTML).toBe(
      '<span>0:A,</span><span>1:,</span><span>2:,B</span><!--for-->',
    )

    selA.value = 1
    selB.value = 0
    await nextTick()
    expect(host.innerHTML).toBe(
      '<span>0:,B</span><span>1:A,</span><span>2:,</span><!--for-->',
    )
  })

  test('coalesces selector source changes before post-flush', async () => {
    let calledTimes = 0
    let expectedCalledTimes = 0

    const list = ref([{ id: 0 }, { id: 1 }, { id: 2 }])
    const index = ref(0)

    const { host } = define(() => {
      const selector = createSelector(() => index.value)
      return createFor(
        () => list.value,
        item => {
          const span = document.createElement('span')
          selector(item.value.id, () => {
            calledTimes++
            span.textContent =
              item.value.id === index.value
                ? `${item.value.id}*`
                : `${item.value.id}`
          })
          return span
        },
        item => item.id,
      )
    }).render()

    expect(host.innerHTML).toBe(
      '<span>0*</span><span>1</span><span>2</span><!--for-->',
    )
    expect(calledTimes).toBe((expectedCalledTimes += 3))

    index.value = 1
    index.value = 2
    await nextTick()

    expect(host.innerHTML).toBe(
      '<span>0</span><span>1</span><span>2*</span><!--for-->',
    )
    expect(calledTimes).toBe((expectedCalledTimes += 2))
  })

  test('fast-reset path: clearing list bulk-resets selector state', async () => {
    const list = ref([{ id: 0 }, { id: 1 }, { id: 2 }])
    const sel = ref(0)
    let resetCalls = 0

    const { host } = define(() => {
      const s = createSelector(() => sel.value)
      // wrap reset to count invocations
      const realReset = s.reset
      s.reset = () => {
        resetCalls++
        realReset()
      }
      const frag = createFor(
        () => list.value,
        item => {
          const span = document.createElement('span')
          s(item.value.id, () => {
            span.textContent =
              item.value.id === sel.value
                ? `${item.value.id}*`
                : `${item.value.id}`
          })
          return span
        },
        item => item.id,
      )
      frag.onReset(s.reset)
      return frag
    }).render()

    expect(host.innerHTML).toBe(
      '<span>0*</span><span>1</span><span>2</span><!--for-->',
    )
    expect(resetCalls).toBe(0)

    list.value = []
    await nextTick()
    expect(host.innerHTML).toBe('<!--for-->')
    expect(resetCalls).toBe(1)

    // After bulk reset, refilling and changing source should still work
    list.value = [{ id: 5 }, { id: 6 }]
    sel.value = 6
    await nextTick()
    expect(host.innerHTML).toBe('<span>5</span><span>6*</span><!--for-->')
  })
})
