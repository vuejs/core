import {
  EffectScope,
  type Ref,
  WatchErrorCodes,
  type WatchOptions,
  type WatchScheduler,
  lazyWatch,
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
      { call },
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
      { call },
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
      watch(onCleanup => {
        source.value

        onCleanup(() => (dummy += 2))
        onWatcherCleanup(() => (dummy += 3))
        onWatcherCleanup(() => (dummy += 5))
      })
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
        {},
      )
      // with scheduler
      watch(
        () => {
          const current = copyist.value
          onWatcherCleanup(() => calls.push(`post ${current}`))
        },
        null,
        { scheduler },
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

  test('lazyWatch should not trigger callback immediately if lazy option is true', () => {
    const source = ref(0)
    let triggered = false

    // Create a lazyWatch instance
    const lazy = lazyWatch(source, () => {
      triggered = true
    })

    // At this point, the callback should not have been triggered
    expect(triggered).toBe(false)

    // Initialize the watcher
    lazy()

    // Change the source value
    source.value++

    // The callback should be triggered now
    expect(triggered).toBe(true)
  })

  test('lazyWatch should trigger callback immediately if lazy option is false', () => {
    const source = ref(0)
    let triggered = false

    // Create a lazyWatch instance with lazy option set to false
    lazyWatch(
      source,
      () => {
        triggered = true
      },
      { lazy: false },
    )

    // Change the source value
    source.value++

    // The callback should be triggered immediately
    expect(triggered).toBe(true)
  })

  test('lazyWatch should handle multiple lazy initializations correctly', () => {
    const source = ref(0)
    let triggeredCount = 0

    // Create a lazyWatch instance
    const lazy = lazyWatch(source, () => {
      triggeredCount++
    })

    // Initialize the watcher once
    lazy()

    // Change the source value
    source.value++

    // The callback should be triggered
    expect(triggeredCount).toBe(1)

    // Initialize the watcher again
    lazy()

    // Change the source value
    source.value++

    // The callback should still be triggered only once per initialization
    expect(triggeredCount).toBe(2)
  })

  test('lazyWatch should handle multiple source refs with lazy option', () => {
    const source1 = ref(0)
    const source2 = ref(0)
    let triggeredCount = 0

    // Create lazyWatch instances for both sources
    const lazy1 = lazyWatch(source1, () => {
      triggeredCount++
    })

    const lazy2 = lazyWatch(source2, () => {
      triggeredCount++
    })

    // Initialize the watchers
    lazy1()
    lazy2()

    // Change both source values
    source1.value++
    source2.value++

    // The callback should be triggered twice
    expect(triggeredCount).toBe(2)
  })

  // Continue with existing tests...

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
})
