import {
  EffectScope,
  type Ref,
  type SchedulerJob,
  WatchErrorCodes,
  type WatchScheduler,
  onWatcherCleanup,
  ref,
  watch,
} from '../src'

const queue: SchedulerJob[] = []

// a simple scheduler for testing purposes
let isFlushPending = false
const resolvedPromise = /*#__PURE__*/ Promise.resolve() as Promise<any>
const nextTick = (fn?: () => any) =>
  fn ? resolvedPromise.then(fn) : resolvedPromise

const scheduler: WatchScheduler = (job, isFirstRun) => {
  if (isFirstRun) {
    job(true)
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

  test('custom error handler', () => {
    const onError = vi.fn()

    watch(
      () => {
        throw 'oops in effect'
      },
      null,
      { onError },
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
      { onError },
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

  test('watch with onEffectCleanup', async () => {
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

  test('nested calls to baseWatch and onEffectCleanup', async () => {
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
})
