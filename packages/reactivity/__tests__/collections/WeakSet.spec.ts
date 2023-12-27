import { reactive, isReactive, effect, toRaw } from '../../src'

describe('reactivity/collections', () => {
  describe('WeakSet', () => {
    it('instanceof', () => {
      const original = new WeakSet()
      const observed = reactive(original)
      expect(isReactive(observed)).toBe(true)
      expect(original).toBeInstanceOf(WeakSet)
      expect(observed).toBeInstanceOf(WeakSet)
    })

    it('should observe mutations', () => {
      let dummy
      const value = {}
      const set = reactive(new WeakSet())
      effect(() => (dummy = set.has(value)))

      expect(dummy).toBe(false)
      set.add(value)
      expect(dummy).toBe(true)
      set.delete(value)
      expect(dummy).toBe(false)
    })

    it('should observe mutations with observed value', () => {
      let dummy
      const value = reactive({})
      const set = reactive(new WeakSet())
      effect(() => (dummy = set.has(value)))

      expect(dummy).toBe(false)
      set.add(value)
      expect(dummy).toBe(true)
      set.delete(value)
      expect(dummy).toBe(false)
    })

    it('should not observe custom property mutations', () => {
      let dummy
      const set: any = reactive(new WeakSet())
      effect(() => (dummy = set.customProp))

      expect(dummy).toBe(undefined)
      set.customProp = 'Hello World'
      expect(dummy).toBe(undefined)
    })

    it('should not observe non value changing mutations', () => {
      let dummy
      const value = {}
      const set = reactive(new WeakSet())
      const setSpy = vi.fn(() => (dummy = set.has(value)))
      effect(setSpy)

      expect(dummy).toBe(false)
      expect(setSpy).toHaveBeenCalledTimes(1)
      set.add(value)
      expect(dummy).toBe(true)
      expect(setSpy).toHaveBeenCalledTimes(2)
      set.add(value)
      expect(dummy).toBe(true)
      expect(setSpy).toHaveBeenCalledTimes(2)
      set.delete(value)
      expect(dummy).toBe(false)
      expect(setSpy).toHaveBeenCalledTimes(3)
      set.delete(value)
      expect(dummy).toBe(false)
      expect(setSpy).toHaveBeenCalledTimes(3)
    })

    it('should not observe raw data', () => {
      const value = {}
      let dummy
      const set = reactive(new WeakSet())
      effect(() => (dummy = toRaw(set).has(value)))

      expect(dummy).toBe(false)
      set.add(value)
      expect(dummy).toBe(false)
    })

    it('should not be triggered by raw mutations', () => {
      const value = {}
      let dummy
      const set = reactive(new WeakSet())
      effect(() => (dummy = set.has(value)))

      expect(dummy).toBe(false)
      toRaw(set).add(value)
      expect(dummy).toBe(false)
    })

    it('should not pollute original Set with Proxies', () => {
      const set = new WeakSet()
      const observed = reactive(set)
      const value = reactive({})
      observed.add(value)
      expect(observed.has(value)).toBe(true)
      expect(set.has(value)).toBe(false)
    })

    it('should return proxy from WeakSet.add call', () => {
      const set = reactive(new WeakSet())
      const result = set.add({})
      expect(result).toBe(set)
    })

    it('should allow custom property get, size, set, clear, forEach, keys, values, entries, Symbol.iterator', () => {
      const o = reactive(new WeakSet()) as any
      const fn = function* () {
        yield 1
        yield 2
        yield 3
      }
      o.get = 1
      o.size = 1
      o.set = 1
      o.clear = 1
      o.forEach = 1
      o.keys = 1
      o.values = 1
      o.entries = 1
      o[Symbol.iterator] = fn
      expect(o.get).toBe(1)
      expect(o.size).toBe(1)
      expect(o.set).toBe(1)
      expect(o.clear).toBe(1)
      expect(o.forEach).toBe(1)
      expect(o.keys).toBe(1)
      expect(o.values).toBe(1)
      expect(o.entries).toBe(1)
      expect(o[Symbol.iterator]).toBe(fn)
    })
  })
})
