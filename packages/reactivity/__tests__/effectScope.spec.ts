import { nextTick, watch, watchEffect } from '@vue/runtime-core'
import {
  type ComputedRef,
  EffectScope,
  computed,
  effect,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  reactive,
  ref,
} from '../src'

describe('reactivity/effect/scope', () => {
  it('should run', () => {
    const fnSpy = vi.fn(() => {})
    effectScope().run(fnSpy)
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })

  it('should accept zero argument', () => {
    const scope = effectScope()
    expect(scope.effects.length).toBe(0)
  })

  it('should return run value', () => {
    expect(effectScope().run(() => 1)).toBe(1)
  })

  it('should work w/ active property', () => {
    const scope = effectScope()
    scope.run(() => 1)
    expect(scope.active).toBe(true)
    scope.stop()
    expect(scope.active).toBe(false)
  })

  it('should collect the effects', () => {
    const scope = effectScope()
    scope.run(() => {
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

    const scope = effectScope()
    scope.run(() => {
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

    const scope = effectScope()
    scope.run(() => {
      effect(() => (dummy = counter.num))
      // nested scope
      effectScope().run(() => {
        effect(() => (doubled = counter.num * 2))
      })
    })

    expect(scope.effects.length).toBe(1)
    expect(scope.scopes!.length).toBe(1)
    expect(scope.scopes![0]).toBeInstanceOf(EffectScope)

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

    const scope = effectScope()
    scope.run(() => {
      effect(() => (dummy = counter.num))
      // nested scope
      effectScope(true).run(() => {
        effect(() => (doubled = counter.num * 2))
      })
    })

    expect(scope.effects.length).toBe(1)

    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)

    scope.stop()

    counter.num = 6
    expect(dummy).toBe(7)

    // nested scope should not be stopped
    expect(doubled).toBe(12)
  })

  it('able to run the scope', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = effectScope()
    scope.run(() => {
      effect(() => (dummy = counter.num))
    })

    expect(scope.effects.length).toBe(1)

    scope.run(() => {
      effect(() => (doubled = counter.num * 2))
    })

    expect(scope.effects.length).toBe(2)

    counter.num = 7
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)

    scope.stop()
  })

  it('can not run an inactive scope', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = effectScope()
    scope.run(() => {
      effect(() => (dummy = counter.num))
    })

    expect(scope.effects.length).toBe(1)

    scope.stop()

    scope.run(() => {
      effect(() => (doubled = counter.num * 2))
    })

    expect('[Vue warn] cannot run an inactive effect scope.').toHaveBeenWarned()

    expect(scope.effects.length).toBe(0)

    counter.num = 7
    expect(dummy).toBe(0)
    expect(doubled).toBe(undefined)
  })

  it('should fire onScopeDispose hook', () => {
    let dummy = 0

    const scope = effectScope()
    scope.run(() => {
      onScopeDispose(() => (dummy += 1))
      onScopeDispose(() => (dummy += 2))
    })

    scope.run(() => {
      onScopeDispose(() => (dummy += 4))
    })

    expect(dummy).toBe(0)

    scope.stop()
    expect(dummy).toBe(7)
  })

  it('should warn onScopeDispose() is called when there is no active effect scope', () => {
    const spy = vi.fn()
    const scope = effectScope()
    scope.run(() => {
      onScopeDispose(spy)
    })

    expect(spy).toHaveBeenCalledTimes(0)

    onScopeDispose(spy)

    expect(
      '[Vue warn] onScopeDispose() is called when there is no active effect scope to be associated with.',
    ).toHaveBeenWarned()

    scope.stop()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should dereference child scope from parent scope after stopping child scope (no memleaks)', () => {
    const parent = effectScope()
    const child = parent.run(() => effectScope())!
    expect(parent.scopes!.includes(child)).toBe(true)
    child.stop()
    expect(parent.scopes!.includes(child)).toBe(false)
  })

  it('test with higher level APIs', async () => {
    const r = ref(1)

    const computedSpy = vi.fn()
    const watchSpy = vi.fn()
    const watchEffectSpy = vi.fn()

    let c: ComputedRef
    const scope = effectScope()
    scope.run(() => {
      c = computed(() => {
        computedSpy()
        return r.value + 1
      })

      watch(r, watchSpy)
      watchEffect(() => {
        watchEffectSpy()
        r.value
        c.value
      })
    })

    expect(computedSpy).toHaveBeenCalledTimes(1)
    expect(watchSpy).toHaveBeenCalledTimes(0)
    expect(watchEffectSpy).toHaveBeenCalledTimes(1)

    r.value++
    await nextTick()
    expect(computedSpy).toHaveBeenCalledTimes(2)
    expect(watchSpy).toHaveBeenCalledTimes(1)
    expect(watchEffectSpy).toHaveBeenCalledTimes(2)

    scope.stop()

    r.value++
    await nextTick()
    // should not trigger anymore
    expect(computedSpy).toHaveBeenCalledTimes(2)
    expect(watchSpy).toHaveBeenCalledTimes(1)
    expect(watchEffectSpy).toHaveBeenCalledTimes(2)
  })

  it('getCurrentScope() stays valid when running a detached nested EffectScope', () => {
    const parentScope = effectScope()

    parentScope.run(() => {
      const currentScope = getCurrentScope()
      expect(currentScope).toBeDefined()
      const detachedScope = effectScope(true)
      detachedScope.run(() => {})

      expect(getCurrentScope()).toBe(currentScope)
    })
  })

  it('calling .off() of a detached scope inside an active scope should not break currentScope', () => {
    const parentScope = effectScope()

    parentScope.run(() => {
      const childScope = effectScope(true)
      childScope.on()
      childScope.off()
      expect(getCurrentScope()).toBe(parentScope)
    })
  })

  it('should pause/resume EffectScope', async () => {
    const counter = reactive({ num: 0 })
    const fnSpy = vi.fn(() => counter.num)
    const scope = new EffectScope()
    scope.run(() => {
      effect(fnSpy)
    })

    expect(fnSpy).toHaveBeenCalledTimes(1)

    counter.num++
    await nextTick()
    expect(fnSpy).toHaveBeenCalledTimes(2)

    scope.pause()
    counter.num++
    await nextTick()
    expect(fnSpy).toHaveBeenCalledTimes(2)

    counter.num++
    await nextTick()
    expect(fnSpy).toHaveBeenCalledTimes(2)

    scope.resume()
    expect(fnSpy).toHaveBeenCalledTimes(3)
  })

  test('removing a watcher while stopping its effectScope', async () => {
    const count = ref(0)
    const scope = effectScope()
    let watcherCalls = 0
    let cleanupCalls = 0

    scope.run(() => {
      const stop1 = watch(count, () => {
        watcherCalls++
      })
      watch(count, (val, old, onCleanup) => {
        watcherCalls++
        onCleanup(() => {
          cleanupCalls++
          stop1()
        })
      })
      watch(count, () => {
        watcherCalls++
      })
    })

    expect(watcherCalls).toBe(0)
    expect(cleanupCalls).toBe(0)

    count.value++
    await nextTick()
    expect(watcherCalls).toBe(3)
    expect(cleanupCalls).toBe(0)

    scope.stop()
    count.value++
    await nextTick()
    expect(watcherCalls).toBe(3)
    expect(cleanupCalls).toBe(1)

    expect(scope.effects.length).toBe(0)
    expect(scope.cleanups.length).toBe(0)
  })
})
