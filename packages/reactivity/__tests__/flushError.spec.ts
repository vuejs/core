import {
  computed,
  createApp,
  effect,
  h,
  nextTick,
  nodeOps,
  ref,
  serializeInner,
  watch,
} from '@vue/runtime-test'

// #15674: an error thrown while notifying a subscriber must not leave the rest
// of the batch unnotified, nor the notify buffer in a state where the batch is
// delivered by an unrelated later write
describe('reactivity: errors during flush', () => {
  test('notifies the remaining subscribers when one throws', () => {
    const a = ref(0)
    const c = computed(() => {
      if (a.value === 2) {
        throw new Error('boom')
      }
      return a.value
    })
    watch(c, () => {}, { flush: 'sync' })

    const runs: string[] = []
    effect(() => {
      a.value
      runs.push('after')
    })
    runs.length = 0

    expect(() => {
      a.value = 2
    }).toThrow('boom')
    expect(runs).toEqual(['after'])
  })

  test('does not deliver a failed batch on an unrelated write', () => {
    const a = ref(0)
    const b = ref(0)
    const runs: string[] = []

    effect(() => {
      a.value
      if (a.value === 1) {
        throw new Error('boom')
      }
      runs.push('a')
    })
    effect(() => {
      a.value
      runs.push('after a')
    })
    effect(() => {
      b.value
      runs.push('b')
    })
    runs.length = 0

    expect(() => {
      a.value = 1
    }).toThrow('boom')
    expect(runs).toEqual(['after a'])

    runs.length = 0
    b.value = 1
    expect(runs).toEqual(['b'])
  })

  test('rethrows the first error after the whole batch has been notified', () => {
    const a = ref(0)
    const runs: string[] = []
    let shouldThrow = false

    effect(() => {
      a.value
      runs.push('first')
      if (shouldThrow) {
        throw new Error('first error')
      }
    })
    effect(() => {
      a.value
      runs.push('second')
      if (shouldThrow) {
        throw new Error('second error')
      }
    })
    runs.length = 0
    shouldThrow = true

    expect(() => {
      a.value = 1
    }).toThrow('first error')
    expect(runs).toEqual(['first', 'second'])
  })

  test('updates the component when a sync watcher throws while notifying', async () => {
    const x = ref<{ y: string } | undefined>({ y: 'a' })
    const y = computed(() => x.value!.y)
    const container = nodeOps.createElement('div')

    const app = createApp({
      setup() {
        watch(y, () => {}, { flush: 'sync' })
      },
      render() {
        return h('div', x.value === undefined ? 'x is unset' : 'x is set')
      },
    })
    app.mount(container)
    expect(serializeInner(container)).toBe('<div>x is set</div>')

    // the error raised by the sync watcher escapes the write
    expect(() => {
      x.value = undefined
    }).toThrow()

    // but the component is still re-rendered
    await nextTick()
    expect(serializeInner(container)).toBe('<div>x is unset</div>')
  })
})
