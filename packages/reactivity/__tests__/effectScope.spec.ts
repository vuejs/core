import {
  reactive,
  effect,
  effectScope,
  stop,
  isEffectScope,
  extendScope,
  computed,
  ref,
  onScopeStopped
} from '../src'

describe('reactivity/effect/scope', () => {
  it('should run the passed function once (wrapped by a effect)', () => {
    const fnSpy = jest.fn(() => {})
    effectScope(fnSpy)
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })

  it('should accept zero argument', () => {
    const scope = effectScope()
    expect(scope._scope.effects.length).toBe(0)
  })

  it('should collect the effects', () => {
    const scope = effectScope(() => {
      let dummy
      const counter = reactive({ num: 0 })
      effect(() => (dummy = counter.num))

      expect(dummy).toBe(0)
      counter.num = 7
      expect(dummy).toBe(7)
    })

    expect(scope._scope.effects.length).toBe(1)
  })

  it('stop', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = effectScope(() => {
      effect(() => (dummy = counter.num))
      effect(() => (doubled = counter.num * 2))
    })

    expect(scope._scope.effects.length).toBe(2)

    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)

    stop(scope)

    counter.num = 6
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)
  })

  it('should collect nested scope', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = effectScope(() => {
      effect(() => (dummy = counter.num))
      // nested scope
      effectScope(() => {
        effect(() => (doubled = counter.num * 2))
      })
    })

    expect(scope._scope.effects.length).toBe(2)
    expect(isEffectScope(scope._scope.effects[1])).toBe(true)

    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)

    // stop the nested scope as well
    stop(scope)

    counter.num = 6
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)
  })

  it('nested scope can be escaped', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = effectScope(() => {
      effect(() => (dummy = counter.num))
      // nested scope
      effectScope(
        () => {
          effect(() => (doubled = counter.num * 2))
        },
        { detached: true }
      )
    })

    expect(scope._scope.effects.length).toBe(1)

    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)

    stop(scope)

    counter.num = 6
    expect(dummy).toBe(7)

    // nested scope should not be stoped
    expect(doubled).toBe(12)
  })

  it('able to extend the scope', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = effectScope(() => {
      effect(() => (dummy = counter.num))
    })

    expect(scope._scope.effects.length).toBe(1)

    extendScope(scope, () => {
      effect(() => (doubled = counter.num * 2))
    })

    expect(scope._scope.effects.length).toBe(2)

    counter.num = 7
    expect(dummy).toBe(7)
    expect(doubled).toBe(14)

    stop(scope)
  })

  it('can not extend an inactive scope', () => {
    let dummy, doubled
    const counter = reactive({ num: 0 })

    const scope = effectScope(() => {
      effect(() => (dummy = counter.num))
    })

    expect(scope._scope.effects.length).toBe(1)

    stop(scope)

    extendScope(scope, () => {
      effect(() => (doubled = counter.num * 2))
    })

    expect('[Vue warn] can not extend on an inactive scope.').toHaveBeenWarned()

    expect(scope._scope.effects.length).toBe(1)

    counter.num = 7
    expect(dummy).toBe(0)
    expect(doubled).toBe(undefined)
  })

  it('should fire onStop hook', () => {
    let dummy = 0

    const scope = effectScope(onStop => {
      onStop(() => (dummy += 1))
      onStop(() => (dummy += 2))
    })

    extendScope(scope, onStop => {
      onStop(() => (dummy += 4))
    })

    expect(dummy).toBe(0)

    stop(scope)
    expect(dummy).toBe(7)
  })

  it('should fire onScopeStopped hook', () => {
    let dummy = 0

    const scope = effectScope(() => {
      onScopeStopped(() => (dummy += 1))
      onScopeStopped(() => (dummy += 2))
    })

    extendScope(scope, () => {
      onScopeStopped(() => (dummy += 4))
    })

    expect(dummy).toBe(0)

    stop(scope)
    expect(dummy).toBe(7)
  })

  it('should forward returns', () => {
    let foo = ref(1)

    const scope = effectScope(() => {
      return {
        doubled: computed(() => foo.value * 2)
      }
    })

    const { doubled } = scope

    expect(doubled.value).toBe(2)

    foo.value += 1
    expect(doubled.value).toBe(4)

    stop(scope)

    foo.value += 1
    expect(doubled.value).toBe(4)
  })

  it('should forward returns on extending', () => {
    let foo = ref(1)

    const scope = effectScope()

    const { tripled } = extendScope(scope, () => {
      return {
        tripled: computed(() => foo.value * 3)
      }
    })

    expect(tripled.value).toBe(3)

    foo.value += 1
    expect(tripled.value).toBe(6)

    stop(scope)

    foo.value += 1
    expect(tripled.value).toBe(6)
  })
})
