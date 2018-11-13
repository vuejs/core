import { computed, observable, effect, stop } from '../src'

describe('observer/computed', () => {
  it('should return updated value', () => {
    const value: any = observable({})
    const cValue = computed(() => value.foo)
    expect(cValue()).toBe(undefined)
    value.foo = 1
    expect(cValue()).toBe(1)
  })

  it('should compute lazily', () => {
    const value: any = observable({})
    const getter = jest.fn(() => value.foo)
    const cValue = computed(getter)

    // lazy
    expect(getter).not.toHaveBeenCalled()

    expect(cValue()).toBe(undefined)
    expect(getter).toHaveBeenCalledTimes(1)

    // should not compute again
    cValue()
    expect(getter).toHaveBeenCalledTimes(1)

    // should not compute until needed
    value.foo = 1
    expect(getter).toHaveBeenCalledTimes(1)

    // now it should compute
    expect(cValue()).toBe(1)
    expect(getter).toHaveBeenCalledTimes(2)

    // should not compute again
    cValue()
    expect(getter).toHaveBeenCalledTimes(2)
  })

  it('should accept context', () => {
    const value: any = observable({})
    let callCtx, callArg
    const getter = function(arg: any) {
      callCtx = this
      callArg = arg
      return value.foo
    }
    const ctx = {}
    const cValue = computed(getter, ctx)
    cValue()
    expect(callCtx).toBe(ctx)
    expect(callArg).toBe(ctx)
  })

  it('should trigger effect', () => {
    const value: any = observable({})
    const cValue = computed(() => value.foo)
    let dummy
    effect(() => {
      dummy = cValue()
    })
    expect(dummy).toBe(undefined)
    value.foo = 1
    expect(dummy).toBe(1)
  })

  it('should work when chained', () => {
    const value: any = observable({ foo: 0 })
    const c1 = computed(() => value.foo)
    const c2 = computed(() => c1() + 1)
    expect(c2()).toBe(1)
    expect(c1()).toBe(0)
    value.foo++
    expect(c2()).toBe(2)
    expect(c1()).toBe(1)
  })

  it('should trigger effect when chained', () => {
    const value: any = observable({ foo: 0 })
    const getter1 = jest.fn(() => value.foo)
    const getter2 = jest.fn(() => {
      return c1() + 1
    })
    const c1 = computed(getter1)
    const c2 = computed(getter2)

    let dummy
    effect(() => {
      dummy = c2()
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
    const value: any = observable({ foo: 0 })
    const getter1 = jest.fn(() => value.foo)
    const getter2 = jest.fn(() => {
      return c1() + 1
    })
    const c1 = computed(getter1)
    const c2 = computed(getter2)

    let dummy
    effect(() => {
      dummy = c1() + c2()
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
    const value: any = observable({})
    const cValue = computed(() => value.foo)
    let dummy
    effect(() => {
      dummy = cValue()
    })
    expect(dummy).toBe(undefined)
    value.foo = 1
    expect(dummy).toBe(1)
    stop(cValue.effect)
    value.foo = 2
    expect(dummy).toBe(1)
  })
})
