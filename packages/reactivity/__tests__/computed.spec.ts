import {
  computed,
  reactive,
  effect,
  ref,
  WritableComputedRef,
  isReadonly,
  setComputedScheduler
} from '../src'

describe('reactivity/computed', () => {
  it('should return updated value', () => {
    const value = reactive<{ foo?: number }>({})
    const cValue = computed(() => value.foo)
    expect(cValue.value).toBe(undefined)
    value.foo = 1
    expect(cValue.value).toBe(1)
  })

  it('should compute lazily', () => {
    const value = reactive<{ foo?: number }>({})
    const getter = jest.fn(() => value.foo)
    const cValue = computed(getter)

    // lazy
    expect(getter).not.toHaveBeenCalled()

    expect(cValue.value).toBe(undefined)
    expect(getter).toHaveBeenCalledTimes(1)

    // should not compute again
    cValue.value
    expect(getter).toHaveBeenCalledTimes(1)

    // should not compute until needed
    value.foo = 1
    expect(getter).toHaveBeenCalledTimes(1)

    // now it should compute
    expect(cValue.value).toBe(1)
    expect(getter).toHaveBeenCalledTimes(2)

    // should not compute again
    cValue.value
    expect(getter).toHaveBeenCalledTimes(2)
  })

  it('should trigger effect', () => {
    const value = reactive<{ foo?: number }>({})
    const cValue = computed(() => value.foo)
    let dummy
    effect(() => {
      dummy = cValue.value
    })
    expect(dummy).toBe(undefined)
    value.foo = 1
    expect(dummy).toBe(1)
  })

  it('should work when chained', () => {
    const value = reactive({ foo: 0 })
    const c1 = computed(() => value.foo)
    const c2 = computed(() => c1.value + 1)
    expect(c2.value).toBe(1)
    expect(c1.value).toBe(0)
    value.foo++
    expect(c2.value).toBe(2)
    expect(c1.value).toBe(1)
  })

  it('should trigger effect when chained', () => {
    const value = reactive({ foo: 0 })
    const getter1 = jest.fn(() => value.foo)
    const getter2 = jest.fn(() => {
      return c1.value + 1
    })
    const c1 = computed(getter1)
    const c2 = computed(getter2)

    let dummy
    effect(() => {
      dummy = c2.value
    })
    expect(dummy).toBe(1)
    expect(getter1).toHaveBeenCalledTimes(1)
    expect(getter2).toHaveBeenCalledTimes(1)
    value.foo++
    expect(dummy).toBe(2)
    // should not result in duplicate calls
    expect(getter1).toHaveBeenCalledTimes(2)
    expect(getter2).toHaveBeenCalledTimes(2)
  })

  it('should trigger effect when chained (mixed invocations)', () => {
    const value = reactive({ foo: 0 })
    const getter1 = jest.fn(() => value.foo)
    const getter2 = jest.fn(() => {
      return c1.value + 1
    })
    const c1 = computed(getter1)
    const c2 = computed(getter2)

    let dummy
    effect(() => {
      dummy = c1.value + c2.value
    })
    expect(dummy).toBe(1)

    expect(getter1).toHaveBeenCalledTimes(1)
    expect(getter2).toHaveBeenCalledTimes(1)
    value.foo++
    expect(dummy).toBe(3)
    // should not result in duplicate calls
    expect(getter1).toHaveBeenCalledTimes(2)
    expect(getter2).toHaveBeenCalledTimes(2)
  })

  it('should no longer update when stopped', () => {
    const value = reactive<{ foo?: number }>({})
    const cValue = computed(() => value.foo)
    let dummy
    effect(() => {
      dummy = cValue.value
    })
    expect(dummy).toBe(undefined)
    value.foo = 1
    expect(dummy).toBe(1)
    cValue.effect.stop()
    value.foo = 2
    expect(dummy).toBe(1)
  })

  it('should support setter', () => {
    const n = ref(1)
    const plusOne = computed({
      get: () => n.value + 1,
      set: val => {
        n.value = val - 1
      }
    })

    expect(plusOne.value).toBe(2)
    n.value++
    expect(plusOne.value).toBe(3)

    plusOne.value = 0
    expect(n.value).toBe(-1)
  })

  it('should trigger effect w/ setter', () => {
    const n = ref(1)
    const plusOne = computed({
      get: () => n.value + 1,
      set: val => {
        n.value = val - 1
      }
    })

    let dummy
    effect(() => {
      dummy = n.value
    })
    expect(dummy).toBe(1)

    plusOne.value = 0
    expect(dummy).toBe(-1)
  })

  it('should warn if trying to set a readonly computed', () => {
    const n = ref(1)
    const plusOne = computed(() => n.value + 1)
    ;(plusOne as WritableComputedRef<number>).value++ // Type cast to prevent TS from preventing the error

    expect(
      'Write operation failed: computed value is readonly'
    ).toHaveBeenWarnedLast()
  })

  it('should be readonly', () => {
    let a = { a: 1 }
    const x = computed(() => a)
    expect(isReadonly(x)).toBe(true)
    expect(isReadonly(x.value)).toBe(false)
    expect(isReadonly(x.value.a)).toBe(false)
    const z = computed<typeof a>({
      get() {
        return a
      },
      set(v) {
        a = v
      }
    })
    expect(isReadonly(z)).toBe(false)
    expect(isReadonly(z.value.a)).toBe(false)
  })

  it('should expose value when stopped', () => {
    const x = computed(() => 1)
    x.effect.stop()
    expect(x.value).toBe(1)
  })

  describe('with scheduler', () => {
    // a simple scheduler similar to the main Vue scheduler
    const tick = Promise.resolve()
    const queue: any[] = []
    let queued = false

    const schedule = (fn: any) => {
      queue.push(fn)
      if (!queued) {
        queued = true
        tick.then(flush)
      }
    }

    const flush = () => {
      for (let i = 0; i < queue.length; i++) {
        queue[i]()
      }
      queue.length = 0
      queued = false
    }

    beforeEach(() => {
      setComputedScheduler(schedule)
    })

    afterEach(() => {
      setComputedScheduler(undefined)
    })

    test('should only trigger once on multiple mutations', async () => {
      const src = ref(0)
      const c = computed(() => src.value)
      const spy = jest.fn()
      effect(() => {
        spy(c.value)
      })
      expect(spy).toHaveBeenCalledTimes(1)
      src.value = 1
      src.value = 2
      src.value = 3
      // not called yet
      expect(spy).toHaveBeenCalledTimes(1)
      await tick
      // should only trigger once
      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenCalledWith(c.value)
    })

    test('should not trigger if value did not change', async () => {
      const src = ref(0)
      const c = computed(() => src.value % 2)
      const spy = jest.fn()
      effect(() => {
        spy(c.value)
      })
      expect(spy).toHaveBeenCalledTimes(1)
      src.value = 1
      src.value = 2

      await tick
      // should not trigger
      expect(spy).toHaveBeenCalledTimes(1)

      src.value = 3
      src.value = 4
      src.value = 5
      await tick
      // should trigger because latest value changes
      expect(spy).toHaveBeenCalledTimes(2)
    })

    test('chained computed trigger', async () => {
      const effectSpy = jest.fn()
      const c1Spy = jest.fn()
      const c2Spy = jest.fn()

      const src = ref(0)
      const c1 = computed(() => {
        c1Spy()
        return src.value % 2
      })
      const c2 = computed(() => {
        c2Spy()
        return c1.value + 1
      })

      effect(() => {
        effectSpy(c2.value)
      })

      expect(c1Spy).toHaveBeenCalledTimes(1)
      expect(c2Spy).toHaveBeenCalledTimes(1)
      expect(effectSpy).toHaveBeenCalledTimes(1)

      src.value = 1
      await tick
      expect(c1Spy).toHaveBeenCalledTimes(2)
      expect(c2Spy).toHaveBeenCalledTimes(2)
      expect(effectSpy).toHaveBeenCalledTimes(2)
    })

    test('chained computed avoid re-compute', async () => {
      const effectSpy = jest.fn()
      const c1Spy = jest.fn()
      const c2Spy = jest.fn()

      const src = ref(0)
      const c1 = computed(() => {
        c1Spy()
        return src.value % 2
      })
      const c2 = computed(() => {
        c2Spy()
        return c1.value + 1
      })

      effect(() => {
        effectSpy(c2.value)
      })

      expect(effectSpy).toHaveBeenCalledTimes(1)
      src.value = 2
      src.value = 4
      src.value = 6
      await tick
      // c1 should re-compute once.
      expect(c1Spy).toHaveBeenCalledTimes(2)
      // c2 should not have to re-compute because c1 did not change.
      expect(c2Spy).toHaveBeenCalledTimes(1)
      // effect should not trigger because c2 did not change.
      expect(effectSpy).toHaveBeenCalledTimes(1)
    })

    test('chained computed value invalidation', async () => {
      const effectSpy = jest.fn()
      const c1Spy = jest.fn()
      const c2Spy = jest.fn()

      const src = ref(0)
      const c1 = computed(() => {
        c1Spy()
        return src.value % 2
      })
      const c2 = computed(() => {
        c2Spy()
        return c1.value + 1
      })

      effect(() => {
        effectSpy(c2.value)
      })

      expect(effectSpy).toHaveBeenCalledTimes(1)
      expect(effectSpy).toHaveBeenCalledWith(1)
      expect(c2.value).toBe(1)

      expect(c1Spy).toHaveBeenCalledTimes(1)
      expect(c2Spy).toHaveBeenCalledTimes(1)

      src.value = 1
      // value should be available sync
      expect(c2.value).toBe(2)
      expect(c2Spy).toHaveBeenCalledTimes(2)
    })

    test('sync access of invalidated chained computed should not prevent final effect from running', async () => {
      const effectSpy = jest.fn()
      const c1Spy = jest.fn()
      const c2Spy = jest.fn()

      const src = ref(0)
      const c1 = computed(() => {
        c1Spy()
        return src.value % 2
      })
      const c2 = computed(() => {
        c2Spy()
        return c1.value + 1
      })

      effect(() => {
        effectSpy(c2.value)
      })
      expect(effectSpy).toHaveBeenCalledTimes(1)

      src.value = 1
      // sync access c2
      c2.value
      await tick
      expect(effectSpy).toHaveBeenCalledTimes(2)
    })
  })
})
