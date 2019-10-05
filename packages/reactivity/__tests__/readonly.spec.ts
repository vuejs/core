import {
  reactive,
  readonly,
  toRaw,
  isReactive,
  isReadonly,
  markNonReactive,
  markReadonly,
  lock,
  unlock,
  effect,
  ref
} from '../src'
import { mockWarn } from '@vue/runtime-test'

describe('reactivity/readonly', () => {
  mockWarn()

  describe('Object', () => {
    it('should make nested values readonly', () => {
      const original = { foo: 1, bar: { baz: 2 } }
      const observed = readonly(original)
      expect(observed).not.toBe(original)
      expect(isReactive(observed)).toBe(true)
      expect(isReadonly(observed)).toBe(true)
      expect(isReactive(original)).toBe(false)
      expect(isReadonly(original)).toBe(false)
      expect(isReactive(observed.bar)).toBe(true)
      expect(isReadonly(observed.bar)).toBe(true)
      expect(isReactive(original.bar)).toBe(false)
      expect(isReadonly(original.bar)).toBe(false)
      // get
      expect(observed.foo).toBe(1)
      // has
      expect('foo' in observed).toBe(true)
      // ownKeys
      expect(Object.keys(observed)).toEqual(['foo', 'bar'])
    })

    it('should not allow mutation', () => {
      const observed: any = readonly({ foo: 1, bar: { baz: 2 } })
      observed.foo = 2
      expect(observed.foo).toBe(1)
      expect(
        `Set operation on key "foo" failed: target is readonly.`
      ).toHaveBeenWarnedLast()
      observed.bar.baz = 3
      expect(observed.bar.baz).toBe(2)
      expect(
        `Set operation on key "baz" failed: target is readonly.`
      ).toHaveBeenWarnedLast()
      delete observed.foo
      expect(observed.foo).toBe(1)
      expect(
        `Delete operation on key "foo" failed: target is readonly.`
      ).toHaveBeenWarnedLast()
      delete observed.bar.baz
      expect(observed.bar.baz).toBe(2)
      expect(
        `Delete operation on key "baz" failed: target is readonly.`
      ).toHaveBeenWarnedLast()
    })

    it('should allow mutation when unlocked', () => {
      const observed: any = readonly({ foo: 1, bar: { baz: 2 } })
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
      expect(`target is readonly`).not.toHaveBeenWarned()
    })

    it('should not trigger effects when locked', () => {
      const observed: any = readonly({ a: 1 })
      let dummy
      effect(() => {
        dummy = observed.a
      })
      expect(dummy).toBe(1)
      observed.a = 2
      expect(observed.a).toBe(1)
      expect(dummy).toBe(1)
      expect(`target is readonly`).toHaveBeenWarned()
    })

    it('should trigger effects when unlocked', () => {
      const observed: any = readonly({ a: 1 })
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
    it('should make nested values readonly', () => {
      const original = [{ foo: 1 }]
      const observed = readonly(original)
      expect(observed).not.toBe(original)
      expect(isReactive(observed)).toBe(true)
      expect(isReadonly(observed)).toBe(true)
      expect(isReactive(original)).toBe(false)
      expect(isReadonly(original)).toBe(false)
      expect(isReactive(observed[0])).toBe(true)
      expect(isReadonly(observed[0])).toBe(true)
      expect(isReactive(original[0])).toBe(false)
      expect(isReadonly(original[0])).toBe(false)
      // get
      expect(observed[0].foo).toBe(1)
      // has
      expect(0 in observed).toBe(true)
      // ownKeys
      expect(Object.keys(observed)).toEqual(['0'])
    })

    it('should not allow mutation', () => {
      const observed: any = readonly([{ foo: 1 }])
      observed[0] = 1
      expect(observed[0]).not.toBe(1)
      expect(
        `Set operation on key "0" failed: target is readonly.`
      ).toHaveBeenWarned()
      observed[0].foo = 2
      expect(observed[0].foo).toBe(1)
      expect(
        `Set operation on key "foo" failed: target is readonly.`
      ).toHaveBeenWarned()

      // should block length mutation
      observed.length = 0
      expect(observed.length).toBe(1)
      expect(observed[0].foo).toBe(1)
      expect(
        `Set operation on key "length" failed: target is readonly.`
      ).toHaveBeenWarned()

      // mutation methods invoke set/length internally and thus are blocked as well
      observed.push(2)
      expect(observed.length).toBe(1)
      // push triggers two warnings on [1] and .length
      expect(`target is readonly.`).toHaveBeenWarnedTimes(5)
    })

    it('should allow mutation when unlocked', () => {
      const observed: any = readonly([{ foo: 1, bar: { baz: 2 } }])
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
      expect(`target is readonly`).not.toHaveBeenWarned()
    })

    it('should not trigger effects when locked', () => {
      const observed: any = readonly([{ a: 1 }])
      let dummy
      effect(() => {
        dummy = observed[0].a
      })
      expect(dummy).toBe(1)
      observed[0].a = 2
      expect(observed[0].a).toBe(1)
      expect(dummy).toBe(1)
      expect(`target is readonly`).toHaveBeenWarnedTimes(1)
      observed[0] = { a: 2 }
      expect(observed[0].a).toBe(1)
      expect(dummy).toBe(1)
      expect(`target is readonly`).toHaveBeenWarnedTimes(2)
    })

    it('should trigger effects when unlocked', () => {
      const observed: any = readonly([{ a: 1 }])
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
      test('should make nested values readonly', () => {
        const key1 = {}
        const key2 = {}
        const original = new Collection([[key1, {}], [key2, {}]])
        const observed = readonly(original)
        expect(observed).not.toBe(original)
        expect(isReactive(observed)).toBe(true)
        expect(isReadonly(observed)).toBe(true)
        expect(isReactive(original)).toBe(false)
        expect(isReadonly(original)).toBe(false)
        expect(isReactive(observed.get(key1))).toBe(true)
        expect(isReadonly(observed.get(key1))).toBe(true)
        expect(isReactive(original.get(key1))).toBe(false)
        expect(isReadonly(original.get(key1))).toBe(false)
      })

      test('should not allow mutation & not trigger effect', () => {
        const map = readonly(new Collection())
        const key = {}
        let dummy
        effect(() => {
          dummy = map.get(key)
        })
        expect(dummy).toBeUndefined()
        map.set(key, 1)
        expect(dummy).toBeUndefined()
        expect(map.has(key)).toBe(false)
        expect(
          `Set operation on key "${key}" failed: target is readonly.`
        ).toHaveBeenWarned()
      })

      test('should allow mutation & trigger effect when unlocked', () => {
        const map = readonly(new Collection())
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
        expect(`target is readonly`).not.toHaveBeenWarned()
      })

      if (Collection === Map) {
        test('should retrieve readonly values on iteration', () => {
          const key1 = {}
          const key2 = {}
          const original = new Collection([[key1, {}], [key2, {}]])
          const observed: any = readonly(original)
          for (const [key, value] of observed) {
            expect(isReadonly(key)).toBe(true)
            expect(isReadonly(value)).toBe(true)
          }
          observed.forEach((value: any) => {
            expect(isReadonly(value)).toBe(true)
          })
          for (const value of observed.values()) {
            expect(isReadonly(value)).toBe(true)
          }
        })
      }
    })
  })

  const sets = [Set, WeakSet]
  sets.forEach((Collection: any) => {
    describe(Collection.name, () => {
      test('should make nested values readonly', () => {
        const key1 = {}
        const key2 = {}
        const original = new Collection([key1, key2])
        const observed = readonly(original)
        expect(observed).not.toBe(original)
        expect(isReactive(observed)).toBe(true)
        expect(isReadonly(observed)).toBe(true)
        expect(isReactive(original)).toBe(false)
        expect(isReadonly(original)).toBe(false)
        expect(observed.has(reactive(key1))).toBe(true)
        expect(original.has(reactive(key1))).toBe(false)
      })

      test('should not allow mutation & not trigger effect', () => {
        const set = readonly(new Collection())
        const key = {}
        let dummy
        effect(() => {
          dummy = set.has(key)
        })
        expect(dummy).toBe(false)
        set.add(key)
        expect(dummy).toBe(false)
        expect(set.has(key)).toBe(false)
        expect(
          `Add operation on key "${key}" failed: target is readonly.`
        ).toHaveBeenWarned()
      })

      test('should allow mutation & trigger effect when unlocked', () => {
        const set = readonly(new Collection())
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
        expect(`target is readonly`).not.toHaveBeenWarned()
      })

      if (Collection === Set) {
        test('should retrieve readonly values on iteration', () => {
          const original = new Collection([{}, {}])
          const observed: any = readonly(original)
          for (const value of observed) {
            expect(isReadonly(value)).toBe(true)
          }
          observed.forEach((value: any) => {
            expect(isReadonly(value)).toBe(true)
          })
          for (const value of observed.values()) {
            expect(isReadonly(value)).toBe(true)
          }
          for (const [v1, v2] of observed.entries()) {
            expect(isReadonly(v1)).toBe(true)
            expect(isReadonly(v2)).toBe(true)
          }
        })
      }
    })
  })

  test('calling reactive on an readonly should return readonly', () => {
    const a = readonly({})
    const b = reactive(a)
    expect(isReadonly(b)).toBe(true)
    // should point to same original
    expect(toRaw(a)).toBe(toRaw(b))
  })

  test('calling readonly on a reactive object should return readonly', () => {
    const a = reactive({})
    const b = readonly(a)
    expect(isReadonly(b)).toBe(true)
    // should point to same original
    expect(toRaw(a)).toBe(toRaw(b))
  })

  test('observing already observed value should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = readonly(original)
    const observed2 = readonly(observed)
    expect(observed2).toBe(observed)
  })

  test('observing the same value multiple times should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = readonly(original)
    const observed2 = readonly(original)
    expect(observed2).toBe(observed)
  })

  test('markNonReactive', () => {
    const obj = readonly({
      foo: { a: 1 },
      bar: markNonReactive({ b: 2 })
    })
    expect(isReactive(obj.foo)).toBe(true)
    expect(isReactive(obj.bar)).toBe(false)
  })

  test('markReadonly', () => {
    const obj = reactive({
      foo: { a: 1 },
      bar: markReadonly({ b: 2 })
    })
    expect(isReactive(obj.foo)).toBe(true)
    expect(isReactive(obj.bar)).toBe(true)
    expect(isReadonly(obj.foo)).toBe(false)
    expect(isReadonly(obj.bar)).toBe(true)
  })

  test('should make ref readonly', () => {
    const n: any = readonly(ref(1))
    n.value = 2
    expect(n.value).toBe(1)
    expect(
      `Set operation on key "value" failed: target is readonly.`
    ).toHaveBeenWarned()
  })
})
