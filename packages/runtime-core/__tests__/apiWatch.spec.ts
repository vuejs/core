import { watch, reactive, computed, nextTick, ref } from '../src/index'

// reference: https://vue-composition-api-rfc.netlify.com/api.html#watch

describe('api: watch', () => {
  it('basic usage', async () => {
    const state = reactive({ count: 0 })
    let dummy
    watch(() => {
      dummy = state.count
    })
    await nextTick()
    expect(dummy).toBe(0)

    state.count++
    await nextTick()
    expect(dummy).toBe(1)
  })

  it('watching single source: getter', async () => {
    const state = reactive({ count: 0 })
    let dummy
    watch(
      () => state.count,
      (count, prevCount) => {
        dummy = [count, prevCount]
      }
    )
    await nextTick()
    expect(dummy).toMatchObject([0, undefined])

    state.count++
    await nextTick()
    expect(dummy).toMatchObject([1, 0])
  })

  it('watching single source: ref', async () => {
    const count = ref(0)
    let dummy
    watch(count, (count, prevCount) => {
      dummy = [count, prevCount]
    })
    await nextTick()
    expect(dummy).toMatchObject([0, undefined])

    count.value++
    await nextTick()
    expect(dummy).toMatchObject([1, 0])
  })

  it('watching single source: computed ref', async () => {
    const count = ref(0)
    const plus = computed(() => count.value + 1)
    let dummy
    watch(plus, (count, prevCount) => {
      dummy = [count, prevCount]
    })
    await nextTick()
    expect(dummy).toMatchObject([1, undefined])

    count.value++
    await nextTick()
    expect(dummy).toMatchObject([2, 1])
  })

  it('watching multiple sources', async () => {
    const state = reactive({ count: 1 })
    const count = ref(1)
    const plus = computed(() => count.value + 1)

    let dummy
    watch([() => state.count, count, plus], (vals, oldVals) => {
      dummy = [vals, oldVals]
    })
    await nextTick()
    expect(dummy).toMatchObject([[1, 1, 2], []])

    state.count++
    count.value++
    await nextTick()
    expect(dummy).toMatchObject([[2, 2, 3], [1, 1, 2]])
  })

  it('stopping the watcher', async () => {
    const state = reactive({ count: 0 })
    let dummy
    const stop = watch(() => {
      dummy = state.count
    })
    await nextTick()
    expect(dummy).toBe(0)

    stop()
    state.count++
    await nextTick()
    // should not update
    expect(dummy).toBe(0)
  })

  it('cleanup registration (basic)', async () => {
    const state = reactive({ count: 0 })
    const cleanup = jest.fn()
    let dummy
    const stop = watch(onCleanup => {
      onCleanup(cleanup)
      dummy = state.count
    })
    await nextTick()
    expect(dummy).toBe(0)

    state.count++
    await nextTick()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(1)

    stop()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('cleanup registration (with source)', async () => {
    const count = ref(0)
    const cleanup = jest.fn()
    let dummy
    const stop = watch(count, (count, prevCount, onCleanup) => {
      onCleanup(cleanup)
      dummy = count
    })
    await nextTick()
    expect(dummy).toBe(0)

    count.value++
    await nextTick()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(1)

    stop()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('flush timing: post', () => {})

  it('flush timing: pre', () => {})

  it('flush timing: sync', () => {})

  it('deep', () => {})

  it('lazy', () => {})

  it('onTrack', () => {})

  it('onTrigger', () => {})
})
