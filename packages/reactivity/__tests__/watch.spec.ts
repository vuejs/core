import {
  EffectScope,
  type Ref,
  WatchErrorCodes,
  type WatchOptions,
  type WatchScheduler,
  computed,
  effect,
  onWatcherCleanup,
  reactive,
  readonly,
  ref,
  shallowReactive,
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

  test('call option with async error handling', async () => {
    const onError = vi.fn()
    const call: WatchOptions['call'] = function call(fn, type, args) {
      if (Array.isArray(fn)) {
        fn.forEach(f => call(f, type, args))
        return
      }
      fn.apply(null, args).catch((error: unknown) => {
        onError(error)
      })
    }

    const source1 = ref(0)
    watch(
      source1,
      async () => {
        throw 'oops in watch'
      },
      { call },
    )

    source1.value++
    await nextTick()
    expect(onError.mock.calls.length).toBe(1)
    expect(onError.mock.calls[0]).toMatchObject(['oops in watch'])

    const source2 = ref(0)
    watch(
      source2,
      async () => {
        throw 'oops in once watch'
      },
      { call, once: true },
    )

    source2.value++
    await nextTick()
    expect(onError.mock.calls.length).toBe(2)
    expect(onError.mock.calls[1]).toMatchObject(['oops in once watch'])
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

  test('watch with immediate reset and sync flush', () => {
    const value = ref(false)

    watch(value, () => {
      value.value = false
    })

    value.value = true
    value.value = true
    expect(value.value).toBe(false)
  })

  test('once watcher should stop when its callback throws', () => {
    const source = ref(0)
    const callback = vi.fn(() => {
      throw new Error('oops')
    })
    watch(source, callback, { once: true })

    expect(() => (source.value = 1)).toThrow('oops')
    expect(() => (source.value = 2)).not.toThrow()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  // #5009
  test('should not track deps of cleanup and callback run inside another effect', () => {
    const source = ref(0)
    const dep = ref(0)
    const cb = vi.fn(() => {
      dep.value
      onWatcherCleanup(() => dep.value)
    })
    watch(source, cb)
    source.value++
    expect(cb).toHaveBeenCalledTimes(1)

    const fn = vi.fn(() => {
      source.value = 10
    })
    effect(fn)
    expect(cb).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledTimes(1)

    dep.value++
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('should restore tracking when cleanup throws inside another effect', () => {
    const source = ref(0)
    const dep = ref(0)
    const err = new Error('cleanup error')
    watch(source, () => {
      onWatcherCleanup(() => {
        throw err
      })
    })
    source.value++

    let dummy
    let caught
    effect(() => {
      try {
        source.value = 10
      } catch (e) {
        caught = e
      }
      dummy = dep.value
    })
    expect(caught).toBe(err)
    expect(dummy).toBe(0)

    dep.value++
    expect(dummy).toBe(1)
  })

  describe('deep watch on arrays', () => {
    test('reactive array of primitives', () => {
      const arr = reactive([1, 2, 3])
      const cb = vi.fn()
      watch(arr, cb, { deep: true })

      arr[0] = 10
      expect(cb).toHaveBeenCalledTimes(1)
      arr.push(4)
      expect(cb).toHaveBeenCalledTimes(2)
      arr.length = 1
      expect(cb).toHaveBeenCalledTimes(3)
      arr.length = 3
      expect(cb).toHaveBeenCalledTimes(4)
      // same value: no trigger
      arr[0] = arr[0]
      expect(cb).toHaveBeenCalledTimes(4)
      // non-index key is not traversed
      ;(arr as any).foo = 1
      expect(cb).toHaveBeenCalledTimes(4)
    })

    test('sparse reactive array', () => {
      const arr = reactive([1, , 3] as number[])
      const cb = vi.fn()
      watch(arr, cb, { deep: true })

      arr[1] = 2
      expect(cb).toHaveBeenCalledTimes(1)
      delete arr[0]
      expect(cb).toHaveBeenCalledTimes(2)
      arr[5] = 6
      expect(cb).toHaveBeenCalledTimes(3)
    })

    test('reactive array of objects', () => {
      const raw = { inner: reactive({ n: 0 }) }
      const arr = reactive<any[]>([{ n: 0 }, raw])
      const cb = vi.fn()
      watch(arr, cb, { deep: true })

      arr[0].n++
      expect(cb).toHaveBeenCalledTimes(1)
      // reactive object nested in a raw object in the array
      raw.inner.n++
      expect(cb).toHaveBeenCalledTimes(2)
      arr.splice(0, 1)
      expect(cb).toHaveBeenCalledTimes(3)
    })

    test('reactive array of refs', () => {
      const r = ref(0)
      const arr = reactive([r])
      const cb = vi.fn()
      watch(arr, cb, { deep: true })

      r.value++
      expect(cb).toHaveBeenCalledTimes(1)
      arr[0] = ref(5)
      expect(cb).toHaveBeenCalledTimes(2)
      // the old ref is no longer tracked
      r.value++
      expect(cb).toHaveBeenCalledTimes(2)
    })

    test('readonly(reactive) array', () => {
      const source = reactive([{ n: 0 }])
      const cb = vi.fn()
      watch(readonly(source), cb, { deep: true })

      source[0].n++
      expect(cb).toHaveBeenCalledTimes(1)
      source.push({ n: 1 })
      expect(cb).toHaveBeenCalledTimes(2)
    })

    test('shallowReactive array', () => {
      const arr = shallowReactive([{ n: 0 }])
      const cb = vi.fn()
      watch(arr, cb, { deep: true })

      // items of a shallow array are raw
      arr[0].n++
      expect(cb).toHaveBeenCalledTimes(0)
      arr[0] = { n: 1 }
      expect(cb).toHaveBeenCalledTimes(1)
    })

    test('raw array with reactive items', () => {
      const item = reactive({ n: 0 })
      const cb = vi.fn()
      watch(() => [item], cb, { deep: true })

      item.n++
      expect(cb).toHaveBeenCalledTimes(1)
    })

    test('depth limit', () => {
      const arr = reactive([{ n: { m: 0 } }])
      const cb = vi.fn()
      watch(arr, cb, { deep: 2 })

      arr[0].n = { m: 1 }
      expect(cb).toHaveBeenCalledTimes(1)
      arr[0].n.m++
      expect(cb).toHaveBeenCalledTimes(1)
    })

    test('symbol keys of objects', () => {
      const key = Symbol('key')
      const obj = reactive({ [key]: { n: 0 } } as Record<symbol, any>)
      const cb = vi.fn()
      watch(obj, cb, { deep: true })

      obj[key].n++
      expect(cb).toHaveBeenCalledTimes(1)
      obj[Symbol('other')] = 1
      expect(cb).toHaveBeenCalledTimes(2)
    })
  })
})
