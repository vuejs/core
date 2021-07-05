import { nextTick, watch, watchEffect } from '@vue/runtime-core'
import {
  reactive,
  effect,
  EffectScope,
  onDispose,
  computed,
  ref,
  ComputedRef
} from '../src'

describe('reactivity/effect/scope', () => {
  it('should run the passed function once (wrapped by a effect)', () => {
    const fnSpy = jest.fn(() => {})
    new EffectScope(fnSpy)
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })

  it('should accept zero argument', () => {
    const scope = new EffectScope()
    expect(scope.effects.length).toBe(0)
  })

  it('should collect the effects', () => {
    const scope = new EffectScope(() => {
      let dummy
      const counter = reactive({ num: 0 })
      effect(() => (dummy = counter.num))

      expect(dummy).toBe(0)
      counter.num = 7
      expect(dummy).toBe(7)
    })

    expect(scope.effects.length).toBe(1)
  })

  it('stop', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = new EffectScope(() => {
      effect(() => (dummy = counter.num))
      effect(() => (doubled = counter.num * 2))
    })

    expect(scope.effects.length).toBe(2)

    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)

    scope.stop()

    counter.num = 6
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)
  })

  it('should collect nested scope', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = new EffectScope(() => {
      effect(() => (dummy = counter.num))
      // nested scope
      new EffectScope(() => {
        effect(() => (doubled = counter.num * 2))
      })
    })

    expect(scope.effects.length).toBe(2)
    expect(scope.effects[1]).toBeInstanceOf(EffectScope)

    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)

    // stop the nested scope as well
    scope.stop()

    counter.num = 6
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)
  })

  it('nested scope can be escaped', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = new EffectScope(() => {
      effect(() => (dummy = counter.num))
      // nested scope
      new EffectScope(() => {
        effect(() => (doubled = counter.num * 2))
      }, true)
    })

    expect(scope.effects.length).toBe(1)

    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)

    scope.stop()

    counter.num = 6
    expect(dummy).toBe(7)

    // nested scope should not be stoped
    expect(doubled).toBe(12)
  })

  it('able to extend the scope', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = new EffectScope(() => {
      effect(() => (dummy = counter.num))
    })

    expect(scope.effects.length).toBe(1)

    scope.extend(() => {
      effect(() => (doubled = counter.num * 2))
    })

    expect(scope.effects.length).toBe(2)

    counter.num = 7
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)

    scope.stop()
  })

  it('can not extend an inactive scope', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = new EffectScope(() => {
      effect(() => (dummy = counter.num))
    })

    expect(scope.effects.length).toBe(1)

    scope.stop()

    scope.extend(() => {
      effect(() => (doubled = counter.num * 2))
    })

    expect(
      '[Vue warn] cannot extend an inactive effect scope.'
    ).toHaveBeenWarned()

    expect(scope.effects.length).toBe(1)

    counter.num = 7
    expect(dummy).toBe(0)
    expect(doubled).toBe(undefined)
  })

  it('should fire onStop hook', () => {
    let dummy = 0

    const scope = new EffectScope(onStop => {
      onStop(() => (dummy += 1))
      onStop(() => (dummy += 2))
    })

    scope.extend(onStop => {
      onStop(() => (dummy += 4))
    })

    expect(dummy).toBe(0)

    scope.stop()
    expect(dummy).toBe(7)
  })

  it('should fire onDispose hook', () => {
    let dummy = 0

    const scope = new EffectScope(() => {
      onDispose(() => (dummy += 1))
      onDispose(() => (dummy += 2))
    })

    scope.extend(() => {
      onDispose(() => (dummy += 4))
    })

    expect(dummy).toBe(0)

    scope.stop()
    expect(dummy).toBe(7)
  })

  it('test with higher level APIs', async () => {
    const r = ref(1)

    const computedSpy = jest.fn()
    const watchSpy = jest.fn()
    const watchEffectSpy = jest.fn()

    let c: ComputedRef
    const scope = new EffectScope(() => {
      c = computed(() => {
        computedSpy()
        return r.value + 1
      })

      watch(r, watchSpy)
      watchEffect(() => {
        watchEffectSpy()
        r.value
      })
    })

    c!.value // computed is lazy so trigger collection
    expect(computedSpy).toHaveBeenCalledTimes(1)
    expect(watchSpy).toHaveBeenCalledTimes(0)
    expect(watchEffectSpy).toHaveBeenCalledTimes(1)

    r.value++
    c!.value
    await nextTick()
    expect(computedSpy).toHaveBeenCalledTimes(2)
    expect(watchSpy).toHaveBeenCalledTimes(1)
    expect(watchEffectSpy).toHaveBeenCalledTimes(2)

    scope.stop()

    r.value++
    c!.value
    await nextTick()
    // should not trigger anymore
    expect(computedSpy).toHaveBeenCalledTimes(2)
    expect(watchSpy).toHaveBeenCalledTimes(1)
    expect(watchEffectSpy).toHaveBeenCalledTimes(2)
  })
})
