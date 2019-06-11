import {
  state,
  immutableState,
  toRaw,
  isState,
  isImmutableState,
  markNonReactive,
  markImmutable,
  lock,
  unlock,
  effect
} from '../src'

describe('observer/immutable', () => {
  let warn: any

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn')
    warn.mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  describe('Object', () => {
    it('should make nested values immutable', () => {
      const original = { foo: 1, bar: { baz: 2 } }
      const observed = immutableState(original)
      expect(observed).not.toBe(original)
      expect(isState(observed)).toBe(true)
      expect(isImmutableState(observed)).toBe(true)
      expect(isState(original)).toBe(false)
      expect(isImmutableState(original)).toBe(false)
      expect(isState(observed.bar)).toBe(true)
      expect(isImmutableState(observed.bar)).toBe(true)
      expect(isState(original.bar)).toBe(false)
      expect(isImmutableState(original.bar)).toBe(false)
      // get
      expect(observed.foo).toBe(1)
      // has
      expect('foo' in observed).toBe(true)
      // ownKeys
      expect(Object.keys(observed)).toEqual(['foo', 'bar'])
    })

    it('should not allow mutation', () => {
      const observed = immutableState({ foo: 1, bar: { baz: 2 } })
      observed.foo = 2
      expect(observed.foo).toBe(1)
      expect(warn).toHaveBeenCalledTimes(1)
      observed.bar.baz = 3
      expect(observed.bar.baz).toBe(2)
      expect(warn).toHaveBeenCalledTimes(2)
      delete observed.foo
      expect(observed.foo).toBe(1)
      expect(warn).toHaveBeenCalledTimes(3)
      delete observed.bar.baz
      expect(observed.bar.baz).toBe(2)
      expect(warn).toHaveBeenCalledTimes(4)
    })

    it('should allow mutation when unlocked', () => {
      const observed: any = immutableState({ foo: 1, bar: { baz: 2 } })
      unlock()
      observed.prop = 2
      observed.bar.qux = 3
      delete observed.bar.baz
      delete observed.foo
      lock()
      expect(observed.prop).toBe(2)
      expect(observed.foo).toBeUndefined()
      expect(observed.bar.qux).toBe(3)
      expect('baz' in observed.bar).toBe(false)
      expect(warn).not.toHaveBeenCalled()
    })

    it('should not trigger effects when locked', () => {
      const observed = immutableState({ a: 1 })
      let dummy
      effect(() => {
        dummy = observed.a
      })
      expect(dummy).toBe(1)
      observed.a = 2
      expect(observed.a).toBe(1)
      expect(dummy).toBe(1)
    })

    it('should trigger effects when unlocked', () => {
      const observed = immutableState({ a: 1 })
      let dummy
      effect(() => {
        dummy = observed.a
      })
      expect(dummy).toBe(1)
      unlock()
      observed.a = 2
      lock()
      expect(observed.a).toBe(2)
      expect(dummy).toBe(2)
    })
  })

  describe('Array', () => {
    it('should make nested values immutable', () => {
      const original: any[] = [{ foo: 1 }]
      const observed = immutableState(original)
      expect(observed).not.toBe(original)
      expect(isState(observed)).toBe(true)
      expect(isImmutableState(observed)).toBe(true)
      expect(isState(original)).toBe(false)
      expect(isImmutableState(original)).toBe(false)
      expect(isState(observed[0])).toBe(true)
      expect(isImmutableState(observed[0])).toBe(true)
      expect(isState(original[0])).toBe(false)
      expect(isImmutableState(original[0])).toBe(false)
      // get
      expect(observed[0].foo).toBe(1)
      // has
      expect(0 in observed).toBe(true)
      // ownKeys
      expect(Object.keys(observed)).toEqual(['0'])
    })

    it('should not allow mutation', () => {
      const observed: any = immutableState([{ foo: 1 }])
      observed[0] = 1
      expect(observed[0]).not.toBe(1)
      expect(warn).toHaveBeenCalledTimes(1)
      observed[0].foo = 2
      expect(observed[0].foo).toBe(1)
      expect(warn).toHaveBeenCalledTimes(2)

      // should block length mutation
      observed.length = 0
      expect(observed.length).toBe(1)
      expect(observed[0].foo).toBe(1)
      expect(warn).toHaveBeenCalledTimes(3)

      // mutation methods invoke set/length internally and thus are blocked as well
      observed.push(2)
      expect(observed.length).toBe(1)
      // push triggers two warnings on [1] and .length
      expect(warn).toHaveBeenCalledTimes(5)
    })

    it('should allow mutation when unlocked', () => {
      const observed: any[] = immutableState([{ foo: 1, bar: { baz: 2 } }])
      unlock()
      observed[1] = 2
      observed.push(3)
      observed[0].foo = 2
      observed[0].bar.baz = 3
      lock()
      expect(observed.length).toBe(3)
      expect(observed[1]).toBe(2)
      expect(observed[2]).toBe(3)
      expect(observed[0].foo).toBe(2)
      expect(observed[0].bar.baz).toBe(3)
      expect(warn).not.toHaveBeenCalled()
    })

    it('should not trigger effects when locked', () => {
      const observed = immutableState([{ a: 1 }])
      let dummy
      effect(() => {
        dummy = observed[0].a
      })
      expect(dummy).toBe(1)
      observed[0].a = 2
      expect(observed[0].a).toBe(1)
      expect(dummy).toBe(1)
      observed[0] = { a: 2 }
      expect(observed[0].a).toBe(1)
      expect(dummy).toBe(1)
    })

    it('should trigger effects when unlocked', () => {
      const observed = immutableState([{ a: 1 }])
      let dummy
      effect(() => {
        dummy = observed[0].a
      })
      expect(dummy).toBe(1)

      unlock()

      observed[0].a = 2
      expect(observed[0].a).toBe(2)
      expect(dummy).toBe(2)

      observed[0] = { a: 3 }
      expect(observed[0].a).toBe(3)
      expect(dummy).toBe(3)

      observed.unshift({ a: 4 })
      expect(observed[0].a).toBe(4)
      expect(dummy).toBe(4)
      lock()
    })
  })

  const maps = [Map, WeakMap]
  maps.forEach((Collection: any) => {
    describe(Collection.name, () => {
      test('should make nested values immutable', () => {
        const key1 = {}
        const key2 = {}
        const original = new Collection([[key1, {}], [key2, {}]])
        const observed = immutableState(original)
        expect(observed).not.toBe(original)
        expect(isState(observed)).toBe(true)
        expect(isImmutableState(observed)).toBe(true)
        expect(isState(original)).toBe(false)
        expect(isImmutableState(original)).toBe(false)
        expect(isState(observed.get(key1))).toBe(true)
        expect(isImmutableState(observed.get(key1))).toBe(true)
        expect(isState(original.get(key1))).toBe(false)
        expect(isImmutableState(original.get(key1))).toBe(false)
      })

      test('should not allow mutation & not trigger effect', () => {
        const map = immutableState(new Collection())
        const key = {}
        let dummy
        effect(() => {
          dummy = map.get(key)
        })
        expect(dummy).toBeUndefined()
        map.set(key, 1)
        expect(dummy).toBeUndefined()
        expect(map.has(key)).toBe(false)
        expect(warn).toHaveBeenCalledTimes(1)
      })

      test('should allow mutation & trigger effect when unlocked', () => {
        const map = immutableState(new Collection())
        const isWeak = Collection === WeakMap
        const key = {}
        let dummy
        effect(() => {
          dummy = map.get(key) + (isWeak ? 0 : map.size)
        })
        expect(dummy).toBeNaN()
        unlock()
        map.set(key, 1)
        lock()
        expect(dummy).toBe(isWeak ? 1 : 2)
        expect(map.get(key)).toBe(1)
        expect(warn).not.toHaveBeenCalled()
      })

      if (Collection === Map) {
        test('should retrive immutable values on iteration', () => {
          const key1 = {}
          const key2 = {}
          const original = new Collection([[key1, {}], [key2, {}]])
          const observed = immutableState(original)
          for (const [key, value] of observed) {
            expect(isImmutableState(key)).toBe(true)
            expect(isImmutableState(value)).toBe(true)
          }
          observed.forEach((value: any) => {
            expect(isImmutableState(value)).toBe(true)
          })
          for (const value of observed.values()) {
            expect(isImmutableState(value)).toBe(true)
          }
        })
      }
    })
  })

  const sets = [Set, WeakSet]
  sets.forEach((Collection: any) => {
    describe(Collection.name, () => {
      test('should make nested values immutable', () => {
        const key1 = {}
        const key2 = {}
        const original = new Collection([key1, key2])
        const observed = immutableState(original)
        expect(observed).not.toBe(original)
        expect(isState(observed)).toBe(true)
        expect(isImmutableState(observed)).toBe(true)
        expect(isState(original)).toBe(false)
        expect(isImmutableState(original)).toBe(false)
        expect(observed.has(state(key1))).toBe(true)
        expect(original.has(state(key1))).toBe(false)
      })

      test('should not allow mutation & not trigger effect', () => {
        const set = immutableState(new Collection())
        const key = {}
        let dummy
        effect(() => {
          dummy = set.has(key)
        })
        expect(dummy).toBe(false)
        set.add(key)
        expect(dummy).toBe(false)
        expect(set.has(key)).toBe(false)
        expect(warn).toHaveBeenCalledTimes(1)
      })

      test('should allow mutation & trigger effect when unlocked', () => {
        const set = immutableState(new Collection())
        const key = {}
        let dummy
        effect(() => {
          dummy = set.has(key)
        })
        expect(dummy).toBe(false)
        unlock()
        set.add(key)
        lock()
        expect(dummy).toBe(true)
        expect(set.has(key)).toBe(true)
        expect(warn).not.toHaveBeenCalled()
      })

      if (Collection === Set) {
        test('should retrive immutable values on iteration', () => {
          const original = new Collection([{}, {}])
          const observed = immutableState(original)
          for (const value of observed) {
            expect(isImmutableState(value)).toBe(true)
          }
          observed.forEach((value: any) => {
            expect(isImmutableState(value)).toBe(true)
          })
          for (const value of observed.values()) {
            expect(isImmutableState(value)).toBe(true)
          }
          for (const [v1, v2] of observed.entries()) {
            expect(isImmutableState(v1)).toBe(true)
            expect(isImmutableState(v2)).toBe(true)
          }
        })
      }
    })
  })

  test('calling observable on an immutable should return immutable', () => {
    const a = immutableState()
    const b = state(a)
    expect(isImmutableState(b)).toBe(true)
    // should point to same original
    expect(toRaw(a)).toBe(toRaw(b))
  })

  test('calling immutable on an observable should return immutable', () => {
    const a = state()
    const b = immutableState(a)
    expect(isImmutableState(b)).toBe(true)
    // should point to same original
    expect(toRaw(a)).toBe(toRaw(b))
  })

  test('observing already observed value should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = immutableState(original)
    const observed2 = immutableState(observed)
    expect(observed2).toBe(observed)
  })

  test('observing the same value multiple times should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = immutableState(original)
    const observed2 = immutableState(original)
    expect(observed2).toBe(observed)
  })

  test('markNonReactive', () => {
    const obj = immutableState({
      foo: { a: 1 },
      bar: markNonReactive({ b: 2 })
    })
    expect(isState(obj.foo)).toBe(true)
    expect(isState(obj.bar)).toBe(false)
  })

  test('markImmutable', () => {
    const obj = state({
      foo: { a: 1 },
      bar: markImmutable({ b: 2 })
    })
    expect(isState(obj.foo)).toBe(true)
    expect(isState(obj.bar)).toBe(true)
    expect(isImmutableState(obj.foo)).toBe(false)
    expect(isImmutableState(obj.bar)).toBe(true)
  })
})
