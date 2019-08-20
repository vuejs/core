import { reactive, isReactive, effect, toRaw } from '../../src'

describe('reactivity/collections', () => {
  describe('WeakSet', () => {
    it('instanceof', () => {
      const original = new Set()
      const observed = reactive(original)
      expect(isReactive(observed)).toBe(true)
      expect(original instanceof Set).toBe(true)
      expect(observed instanceof Set).toBe(true)
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
      const setSpy = jest.fn(() => (dummy = set.has(value)))
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
  })
})
