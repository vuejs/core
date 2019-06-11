import { state, effect, toRaw, isState } from '../../src'

describe('observer/collections', () => {
  describe('WeakMap', () => {
    test('instanceof', () => {
      const original = new WeakMap()
      const observed = state(original)
      expect(isState(observed)).toBe(true)
      expect(original instanceof WeakMap).toBe(true)
      expect(observed instanceof WeakMap).toBe(true)
    })

    it('should observe mutations', () => {
      let dummy
      const key = {}
      const map = state(new WeakMap())
      effect(() => {
        dummy = map.get(key)
      })

      expect(dummy).toBe(undefined)
      map.set(key, 'value')
      expect(dummy).toBe('value')
      map.set(key, 'value2')
      expect(dummy).toBe('value2')
      map.delete(key)
      expect(dummy).toBe(undefined)
    })

    it('should not observe custom property mutations', () => {
      let dummy
      const map: any = state(new WeakMap())
      effect(() => (dummy = map.customProp))

      expect(dummy).toBe(undefined)
      map.customProp = 'Hello World'
      expect(dummy).toBe(undefined)
    })

    it('should not observe non value changing mutations', () => {
      let dummy
      const key = {}
      const map = state(new WeakMap())
      const mapSpy = jest.fn(() => (dummy = map.get(key)))
      effect(mapSpy)

      expect(dummy).toBe(undefined)
      expect(mapSpy).toHaveBeenCalledTimes(1)
      map.set(key, 'value')
      expect(dummy).toBe('value')
      expect(mapSpy).toHaveBeenCalledTimes(2)
      map.set(key, 'value')
      expect(dummy).toBe('value')
      expect(mapSpy).toHaveBeenCalledTimes(2)
      map.delete(key)
      expect(dummy).toBe(undefined)
      expect(mapSpy).toHaveBeenCalledTimes(3)
      map.delete(key)
      expect(dummy).toBe(undefined)
      expect(mapSpy).toHaveBeenCalledTimes(3)
    })

    it('should not observe raw data', () => {
      let dummy
      const key = {}
      const map = state(new WeakMap())
      effect(() => (dummy = toRaw(map).get(key)))

      expect(dummy).toBe(undefined)
      map.set(key, 'Hello')
      expect(dummy).toBe(undefined)
      map.delete(key)
      expect(dummy).toBe(undefined)
    })

    it('should not pollute original Map with Proxies', () => {
      const map = new WeakMap()
      const observed = state(map)
      const key = {}
      const value = state({})
      observed.set(key, value)
      expect(map.get(key)).not.toBe(value)
      expect(map.get(key)).toBe(toRaw(value))
    })

    it('should return observable versions of contained values', () => {
      const observed = state(new WeakMap())
      const key = {}
      const value = {}
      observed.set(key, value)
      const wrapped = observed.get(key)
      expect(isState(wrapped)).toBe(true)
      expect(toRaw(wrapped)).toBe(value)
    })

    it('should observed nested data', () => {
      const observed = state(new Map())
      const key = {}
      observed.set(key, { a: 1 })
      let dummy
      effect(() => {
        dummy = observed.get(key).a
      })
      observed.get(key).a = 2
      expect(dummy).toBe(2)
    })
  })
})
