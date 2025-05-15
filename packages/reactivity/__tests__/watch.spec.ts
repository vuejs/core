import {
  EffectScope,
  type Ref,
  WatchErrorCodes,
  type WatchOptions,
  type WatchScheduler,
  computed,
  onWatcherCleanup,
  ref,
  watch,
} from '../src'

const queue: (() => void)[] = []

// a simple scheduler for testing purposes
let isFlushPending = false
const resolvedPromise = /*@__PURE__*/ Promise.resolve() as Promise<any>
const nextTick = (fn?: () => any) =>
  fn ? resolvedPromise.then(fn) : resolvedPromise

const scheduler: WatchScheduler = (job, isFirstRun) => {
  if (isFirstRun) {
    job()
  } else {
    queue.push(job)
    flushJobs()
  }
}

const flushJobs = () => {
  if (isFlushPending) return
  isFlushPending = true
  resolvedPromise.then(() => {
    queue.forEach(job => job())
    queue.length = 0
    isFlushPending = false
  })
}

describe('watch', () => {
  test('effect', () => {
    let dummy: any
    const source = ref(0)
    watch(() => {
      dummy = source.value
    })
    expect(dummy).toBe(0)
    source.value++
    expect(dummy).toBe(1)
  })

  test('with callback', () => {
    let dummy: any
    const source = ref(0)
    watch(source, () => {
      dummy = source.value
    })
    expect(dummy).toBe(undefined)
    source.value++
    expect(dummy).toBe(1)
  })

  test('call option with error handling', () => {
    const onError = vi.fn()
    const call: WatchOptions['call'] = function call(fn, type, args) {
      if (Array.isArray(fn)) {
        fn.forEach(f => call(f, type, args))
        return
      }
      try {
        fn.apply(null, args)
      } catch (e) {
        onError(e, type)
      }
    }

    watch(
      () => {
        throw 'oops in effect'
      },
      null,
      { call, lazy: true }, // Ensure lazy behavior doesn't trigger extra errors
    )

    const source = ref(0)
    const effect = watch(
      source,
      () => {
        onWatcherCleanup(() => {
          throw 'oops in cleanup'
        })
        throw 'oops in watch'
      },
      { call, lazy: true }, // Here as well
    )

    expect(onError.mock.calls.length).toBe(1)
    expect(onError.mock.calls[0]).toMatchObject([
      'oops in effect',
      WatchErrorCodes.WATCH_CALLBACK,
    ])

    source.value++
    expect(onError.mock.calls.length).toBe(2)
    expect(onError.mock.calls[1]).toMatchObject([
      'oops in watch',
      WatchErrorCodes.WATCH_CALLBACK,
    ])

    effect!.stop()
    source.value++
    expect(onError.mock.calls.length).toBe(3)
    expect(onError.mock.calls[2]).toMatchObject([
      'oops in cleanup',
      WatchErrorCodes.WATCH_CLEANUP,
    ])
  })

  test('watch with onWatcherCleanup', async () => {
    let dummy = 0
    let source: Ref<number>
    const scope = new EffectScope()

    scope.run(() => {
      source = ref(0)
      watch(
        onCleanup => {
          source.value

          onCleanup(() => (dummy += 2))
          onWatcherCleanup(() => (dummy += 3))
          onWatcherCleanup(() => (dummy += 5))
        },
        null,
        { lazy: true },
      )
    })
    expect(dummy).toBe(0)

    scope.run(() => {
      source.value++
    })
    expect(dummy).toBe(10)

    scope.run(() => {
      source.value++
    })
    expect(dummy).toBe(20)

    scope.stop()
    expect(dummy).toBe(30)
  })

  test('nested calls to baseWatch and onWatcherCleanup', async () => {
    let calls: string[] = []
    let source: Ref<number>
    let copyist: Ref<number>
    const scope = new EffectScope()

    scope.run(() => {
      source = ref(0)
      copyist = ref(0)
      // sync by default
      watch(
        () => {
          const current = (copyist.value = source.value)
          onWatcherCleanup(() => calls.push(`sync ${current}`))
        },
        null,
        { lazy: true },
      )
      // with scheduler
      watch(
        () => {
          const current = copyist.value
          onWatcherCleanup(() => calls.push(`post ${current}`))
        },
        null,
        { scheduler, lazy: true }, // Make this lazy as well
      )
    })

    await nextTick()
    expect(calls).toEqual([])

    scope.run(() => source.value++)
    expect(calls).toEqual(['sync 0'])
    await nextTick()
    expect(calls).toEqual(['sync 0', 'post 0'])
    calls.length = 0

    scope.run(() => source.value++)
    expect(calls).toEqual(['sync 1'])
    await nextTick()
    expect(calls).toEqual(['sync 1', 'post 1'])
    calls.length = 0

    scope.stop()
    expect(calls).toEqual(['sync 2', 'post 2'])
  })

  test('once option should be ignored by simple watch', async () => {
    let dummy: any
    const source = ref(0)
    watch(
      () => {
        dummy = source.value
      },
      null,
      { once: true },
    )
    expect(dummy).toBe(0)

    source.value++
    expect(dummy).toBe(1)
  })

  test('with callback', () => {
    let dummy: any
    const source = ref(0)
    watch(source, () => {
      dummy = source.value
    })
    expect(dummy).toBe(undefined)
    source.value++
    expect(dummy).toBe(1)
  })
  test('lazy watcher should not run immediately', () => {
    const source = ref(0)
    let callCount = 0

    const stop = watch(
      source,
      (newValue, oldValue) => {
        callCount++
      },
      { lazy: true },
    )

    expect(callCount).toBe(0)
    source.value++
    expect(callCount).toBe(1)

    source.value++
    expect(callCount).toBe(2)

    stop()
  })
  test('multiple watchers on the same source with { lazy: true }', async () => {
    let dummy1: any
    let dummy2: any
    const source = ref(0)

    const stop1 = watch(
      () => source.value,
      newVal => {
        dummy1 = newVal
      },
      { lazy: true },
    )

    const stop2 = watch(
      () => source.value,
      newVal => {
        dummy2 = newVal
      },
      { lazy: true },
    )

    expect(dummy1).toBeUndefined()
    expect(dummy2).toBeUndefined()

    source.value++

    await nextTick()

    expect(dummy1).toBe(1)
    expect(dummy2).toBe(1)

    stop1()
    stop2()
  })
  test('lazy watcher with manual start', async () => {
    let dummy: any
    const source = ref(0)

    const { start, stop } = watch(
      () => source.value,
      newVal => {
        dummy = newVal
      },
      { lazy: true },
    )

    expect(dummy).toBeUndefined()

    start()

    source.value = 1

    await nextTick()

    expect(dummy).toBe(1)

    source.value = 2

    await nextTick()

    expect(dummy).toBe(2)

    stop()
  // #12033
  test('recursive sync watcher on computed', () => {
    const r = ref(0)
    const c = computed(() => r.value)

    watch(c, v => {
      if (v > 1) {
        r.value--
      }
    })

    expect(r.value).toBe(0)
    expect(c.value).toBe(0)

    r.value = 10
    expect(r.value).toBe(1)
    expect(c.value).toBe(1)
  })

  // edge case where a nested endBatch() causes an effect to be batched in a
  // nested batch loop with its .next mutated, causing the outer loop to end
  // early
  test('nested batch edge case', () => {
    // useClamp from VueUse
    const clamp = (n: number, min: number, max: number) =>
      Math.min(max, Math.max(min, n))
    function useClamp(src: Ref<number>, min: number, max: number) {
      return computed({
        get() {
          return (src.value = clamp(src.value, min, max))
        },
        set(val) {
          src.value = clamp(val, min, max)
        },
      })
    }

    const src = ref(1)
    const clamped = useClamp(src, 1, 5)
    watch(src, val => (clamped.value = val))

    const spy = vi.fn()
    watch(clamped, spy)

    src.value = 2
    expect(spy).toHaveBeenCalledTimes(1)
    src.value = 10
    expect(spy).toHaveBeenCalledTimes(2)
  })

  test('should ensure correct execution order in batch processing', () => {
    const dummy: number[] = []
    const n1 = ref(0)
    const n2 = ref(0)
    const sum = computed(() => n1.value + n2.value)
    watch(n1, () => {
      dummy.push(1)
      n2.value++
    })
    watch(sum, () => dummy.push(2))
    watch(n1, () => dummy.push(3))

    n1.value++

    expect(dummy).toEqual([1, 2, 3])
  })
})
