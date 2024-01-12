import type { Scheduler, SchedulerJob } from '../src/baseWatch'
import {
  BaseWatchErrorCodes,
  EffectScope,
  type Ref,
  baseWatch,
  onEffectCleanup,
  ref,
} from '../src'

const queue: SchedulerJob[] = []

// these codes are a simple scheduler
let isFlushPending = false
const resolvedPromise = /*#__PURE__*/ Promise.resolve() as Promise<any>
const nextTick = (fn?: () => any) =>
  fn ? resolvedPromise.then(fn) : resolvedPromise
const scheduler: Scheduler = job => {
  queue.push(job)
  flushJobs()
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

describe('baseWatch', () => {
  test('effect', () => {
    let dummy: any
    const source = ref(0)
    baseWatch(() => {
      dummy = source.value
    })
    expect(dummy).toBe(0)
    source.value++
    expect(dummy).toBe(1)
  })

  test('watch', () => {
    let dummy: any
    const source = ref(0)
    baseWatch(source, () => {
      dummy = source.value
    })
    expect(dummy).toBe(undefined)
    source.value++
    expect(dummy).toBe(1)
  })

  test('custom error handler', () => {
    const onError = vi.fn()

    baseWatch(
      () => {
        throw 'oops in effect'
      },
      null,
      { onError },
    )

    const source = ref(0)
    const effect = baseWatch(
      source,
      () => {
        onEffectCleanup(() => {
          throw 'oops in cleanup'
        })
        throw 'oops in watch'
      },
      { onError },
    )

    expect(onError.mock.calls.length).toBe(1)
    expect(onError.mock.calls[0]).toMatchObject([
      'oops in effect',
      BaseWatchErrorCodes.WATCH_CALLBACK,
    ])

    source.value++
    expect(onError.mock.calls.length).toBe(2)
    expect(onError.mock.calls[1]).toMatchObject([
      'oops in watch',
      BaseWatchErrorCodes.WATCH_CALLBACK,
    ])

    effect!.stop()
    source.value++
    expect(onError.mock.calls.length).toBe(3)
    expect(onError.mock.calls[2]).toMatchObject([
      'oops in cleanup',
      BaseWatchErrorCodes.WATCH_CLEANUP,
    ])
  })

  test('baseWatch with onEffectCleanup', async () => {
    let dummy = 0
    let source: Ref<number>
    const scope = new EffectScope()

    scope.run(() => {
      source = ref(0)
      baseWatch(onCleanup => {
        source.value

        onCleanup(() => (dummy += 2))
        onEffectCleanup(() => (dummy += 3))
        onEffectCleanup(() => (dummy += 5))
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
      baseWatch(
        () => {
          const current = (copyist.value = source.value)
          onEffectCleanup(() => calls.push(`sync ${current}`))
        },
        null,
        {},
      )
      // with scheduler
      baseWatch(
        () => {
          const current = copyist.value
          onEffectCleanup(() => calls.push(`post ${current}`))
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
  test('baseWatch with middleware', async () => {
    let effectCalls: string[] = []
    let watchCalls: string[] = []
    const source = ref(0)

    // effect
    baseWatch(
      () => {
        source.value
        effectCalls.push('effect')
        onEffectCleanup(() => effectCalls.push('effect cleanup'))
      },
      null,
      {
        scheduler,
        middleware: next => {
          effectCalls.push('before effect running')
          next()
          effectCalls.push('effect ran')
        },
      },
    )
    // watch
    baseWatch(
      () => source.value,
      () => {
        watchCalls.push('watch')
        onEffectCleanup(() => watchCalls.push('watch cleanup'))
      },
      {
        scheduler,
        middleware: next => {
          watchCalls.push('before watch running')
          next()
          watchCalls.push('watch ran')
        },
      },
    )

    expect(effectCalls).toEqual([])
    expect(watchCalls).toEqual([])
    await nextTick()
    expect(effectCalls).toEqual([
      'before effect running',
      'effect',
      'effect ran',
    ])
    expect(watchCalls).toEqual([])
    effectCalls.length = 0
    watchCalls.length = 0

    source.value++
    await nextTick()
    expect(effectCalls).toEqual([
      'before effect running',
      'effect cleanup',
      'effect',
      'effect ran',
    ])
    expect(watchCalls).toEqual(['before watch running', 'watch', 'watch ran'])
    effectCalls.length = 0
    watchCalls.length = 0

    source.value++
    await nextTick()
    expect(effectCalls).toEqual([
      'before effect running',
      'effect cleanup',
      'effect',
      'effect ran',
    ])
    expect(watchCalls).toEqual([
      'before watch running',
      'watch cleanup',
      'watch',
      'watch ran',
    ])
  })
})
