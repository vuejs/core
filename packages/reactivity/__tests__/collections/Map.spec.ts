import { reactive, effect, toRaw, isReactive } from '../../src'

describe('reactivity/collections', () => {
  function coverCollectionFn(collection: Map<any, any>, fnName: string) {
    const spy = jest.fn()
    let proxy = reactive(collection)
    ;(collection as any)[fnName] = spy
    return [proxy as any, spy]
  }

  describe('Map', () => {
    test('instanceof', () => {
      const original = new Map()
      const observed = reactive(original)
      expect(isReactive(observed)).toBe(true)
      expect(original instanceof Map).toBe(true)
      expect(observed instanceof Map).toBe(true)
    })

    it('should observe mutations', () => {
      let dummy
      const map = reactive(new Map())
      effect(() => {
        dummy = map.get('key')
      })

      expect(dummy).toBe(undefined)
      map.set('key', 'value')
      expect(dummy).toBe('value')
      map.set('key', 'value2')
      expect(dummy).toBe('value2')
      map.delete('key')
      expect(dummy).toBe(undefined)
    })

    it('should observe mutations with observed value as key', () => {
      let dummy
      const key = reactive({})
      const value = reactive({})
      const map = reactive(new Map())
      effect(() => {
        dummy = map.get(key)
      })

      expect(dummy).toBe(undefined)
      map.set(key, value)
      expect(dummy).toBe(value)
      map.delete(key)
      expect(dummy).toBe(undefined)
    })

    it('should observe size mutations', () => {
      let dummy
      const map = reactive(new Map())
      effect(() => (dummy = map.size))

      expect(dummy).toBe(0)
      map.set('key1', 'value')
      map.set('key2', 'value2')
      expect(dummy).toBe(2)
      map.delete('key1')
      expect(dummy).toBe(1)
      map.clear()
      expect(dummy).toBe(0)
    })

    it('should observe for of iteration', () => {
      let dummy
      const map = reactive(new Map())
      effect(() => {
        dummy = 0
        // eslint-disable-next-line no-unused-vars
        for (let [key, num] of map) {
          key
          dummy += num
        }
      })

      expect(dummy).toBe(0)
      map.set('key1', 3)
      expect(dummy).toBe(3)
      map.set('key2', 2)
      expect(dummy).toBe(5)
      // iteration should track mutation of existing entries (#709)
      map.set('key1', 4)
      expect(dummy).toBe(6)
      map.delete('key1')
      expect(dummy).toBe(2)
      map.clear()
      expect(dummy).toBe(0)
    })

    it('should observe forEach iteration', () => {
      let dummy: any
      const map = reactive(new Map())
      effect(() => {
        dummy = 0
        map.forEach((num: any) => (dummy += num))
      })

      expect(dummy).toBe(0)
      map.set('key1', 3)
      expect(dummy).toBe(3)
      map.set('key2', 2)
      expect(dummy).toBe(5)
      // iteration should track mutation of existing entries (#709)
      map.set('key1', 4)
      expect(dummy).toBe(6)
      map.delete('key1')
      expect(dummy).toBe(2)
      map.clear()
      expect(dummy).toBe(0)
    })

    it('should observe keys iteration', () => {
      let dummy
      const map = reactive(new Map())
      effect(() => {
        dummy = 0
        for (let key of map.keys()) {
          dummy += key
        }
      })

      expect(dummy).toBe(0)
      map.set(3, 3)
      expect(dummy).toBe(3)
      map.set(2, 2)
      expect(dummy).toBe(5)
      map.delete(3)
      expect(dummy).toBe(2)
      map.clear()
      expect(dummy).toBe(0)
    })

    it('should observe values iteration', () => {
      let dummy
      const map = reactive(new Map())
      effect(() => {
        dummy = 0
        for (let num of map.values()) {
          dummy += num
        }
      })

      expect(dummy).toBe(0)
      map.set('key1', 3)
      expect(dummy).toBe(3)
      map.set('key2', 2)
      expect(dummy).toBe(5)
      // iteration should track mutation of existing entries (#709)
      map.set('key1', 4)
      expect(dummy).toBe(6)
      map.delete('key1')
      expect(dummy).toBe(2)
      map.clear()
      expect(dummy).toBe(0)
    })

    it('should observe entries iteration', () => {
      let dummy
      let dummy2
      const map = reactive(new Map())
      effect(() => {
        dummy = ''
        dummy2 = 0
        // eslint-disable-next-line no-unused-vars
        for (let [key, num] of map.entries()) {
          dummy += key
          dummy2 += num
        }
      })

      expect(dummy).toBe('')
      expect(dummy2).toBe(0)
      map.set('key1', 3)
      expect(dummy).toBe('key1')
      expect(dummy2).toBe(3)
      map.set('key2', 2)
      expect(dummy).toBe('key1key2')
      expect(dummy2).toBe(5)
      // iteration should track mutation of existing entries (#709)
      map.set('key1', 4)
      expect(dummy).toBe('key1key2')
      expect(dummy2).toBe(6)
      map.delete('key1')
      expect(dummy).toBe('key2')
      expect(dummy2).toBe(2)
      map.clear()
      expect(dummy).toBe('')
      expect(dummy2).toBe(0)
    })

    it('should be triggered by clearing', () => {
      let dummy
      const map = reactive(new Map())
      effect(() => (dummy = map.get('key')))

      expect(dummy).toBe(undefined)
      map.set('key', 3)
      expect(dummy).toBe(3)
      map.clear()
      expect(dummy).toBe(undefined)
    })

    it('should not observe custom property mutations', () => {
      let dummy
      const map: any = reactive(new Map())
      effect(() => (dummy = map.customProp))

      expect(dummy).toBe(undefined)
      map.customProp = 'Hello World'
      expect(dummy).toBe(undefined)
    })

    it('should not observe non value changing mutations', () => {
      let dummy
      const map = reactive(new Map())
      const mapSpy = jest.fn(() => (dummy = map.get('key')))
      effect(mapSpy)

      expect(dummy).toBe(undefined)
      expect(mapSpy).toHaveBeenCalledTimes(1)
      map.set('key', undefined)
      expect(dummy).toBe(undefined)
      expect(mapSpy).toHaveBeenCalledTimes(2)
      map.set('key', 'value')
      expect(dummy).toBe('value')
      expect(mapSpy).toHaveBeenCalledTimes(3)
      map.set('key', 'value')
      expect(dummy).toBe('value')
      expect(mapSpy).toHaveBeenCalledTimes(3)
      map.delete('key')
      expect(dummy).toBe(undefined)
      expect(mapSpy).toHaveBeenCalledTimes(4)
      map.delete('key')
      expect(dummy).toBe(undefined)
      expect(mapSpy).toHaveBeenCalledTimes(4)
      map.clear()
      expect(dummy).toBe(undefined)
      expect(mapSpy).toHaveBeenCalledTimes(4)
    })

    it('should not observe raw data', () => {
      let dummy
      const map = reactive(new Map())
      effect(() => (dummy = toRaw(map).get('key')))

      expect(dummy).toBe(undefined)
      map.set('key', 'Hello')
      expect(dummy).toBe(undefined)
      map.delete('key')
      expect(dummy).toBe(undefined)
    })

    it('should not pollute original Map with Proxies', () => {
      const map = new Map()
      const observed = reactive(map)
      const value = reactive({})
      observed.set('key', value)
      expect(map.get('key')).not.toBe(value)
      expect(map.get('key')).toBe(toRaw(value))
    })

    it('should return observable versions of contained values', () => {
      const observed = reactive(new Map())
      const value = {}
      observed.set('key', value)
      const wrapped = observed.get('key')
      expect(isReactive(wrapped)).toBe(true)
      expect(toRaw(wrapped)).toBe(value)
    })

    it('should observed nested data', () => {
      const observed = reactive(new Map())
      observed.set('key', { a: 1 })
      let dummy
      effect(() => {
        dummy = observed.get('key').a
      })
      observed.get('key').a = 2
      expect(dummy).toBe(2)
    })

    it('should observe nested values in iterations (forEach)', () => {
      const map = reactive(new Map([[1, { foo: 1 }]]))
      let dummy: any
      effect(() => {
        dummy = 0
        map.forEach(value => {
          expect(isReactive(value)).toBe(true)
          dummy += value.foo
        })
      })
      expect(dummy).toBe(1)
      map.get(1)!.foo++
      expect(dummy).toBe(2)
    })

    it('should observe nested values in iterations (values)', () => {
      const map = reactive(new Map([[1, { foo: 1 }]]))
      let dummy: any
      effect(() => {
        dummy = 0
        for (const value of map.values()) {
          expect(isReactive(value)).toBe(true)
          dummy += value.foo
        }
      })
      expect(dummy).toBe(1)
      map.get(1)!.foo++
      expect(dummy).toBe(2)
    })

    it('should observe nested values in iterations (entries)', () => {
      const key = {}
      const map = reactive(new Map([[key, { foo: 1 }]]))
      let dummy: any
      effect(() => {
        dummy = 0
        for (const [key, value] of map.entries()) {
          key
          expect(isReactive(key)).toBe(true)
          expect(isReactive(value)).toBe(true)
          dummy += value.foo
        }
      })
      expect(dummy).toBe(1)
      map.get(key)!.foo++
      expect(dummy).toBe(2)
    })

    it('should observe nested values in iterations (for...of)', () => {
      const key = {}
      const map = reactive(new Map([[key, { foo: 1 }]]))
      let dummy: any
      effect(() => {
        dummy = 0
        for (const [key, value] of map) {
          key
          expect(isReactive(key)).toBe(true)
          expect(isReactive(value)).toBe(true)
          dummy += value.foo
        }
      })
      expect(dummy).toBe(1)
      map.get(key)!.foo++
      expect(dummy).toBe(2)
    })

    it('should not be trigger when the value and the old value both are NaN', () => {
      const map = reactive(new Map([['foo', NaN]]))
      const mapSpy = jest.fn(() => map.get('foo'))
      effect(mapSpy)
      map.set('foo', NaN)
      expect(mapSpy).toHaveBeenCalledTimes(1)
    })

    it('should work with reactive keys in raw map', () => {
      const raw = new Map()
      const key = reactive({})
      raw.set(key, 1)
      const map = reactive(raw)

      expect(map.has(key)).toBe(true)
      expect(map.get(key)).toBe(1)

      expect(map.delete(key)).toBe(true)
      expect(map.has(key)).toBe(false)
      expect(map.get(key)).toBeUndefined()
    })

    it('should track set of reactive keys in raw map', () => {
      const raw = new Map()
      const key = reactive({})
      raw.set(key, 1)
      const map = reactive(raw)

      let dummy
      effect(() => {
        dummy = map.get(key)
      })
      expect(dummy).toBe(1)

      map.set(key, 2)
      expect(dummy).toBe(2)
    })

    it('should track deletion of reactive keys in raw map', () => {
      const raw = new Map()
      const key = reactive({})
      raw.set(key, 1)
      const map = reactive(raw)

      let dummy
      effect(() => {
        dummy = map.has(key)
      })
      expect(dummy).toBe(true)

      map.delete(key)
      expect(dummy).toBe(false)
    })

    it('should warn when both raw and reactive versions of the same object is used as key', () => {
      const raw = new Map()
      const rawKey = {}
      const key = reactive(rawKey)
      raw.set(rawKey, 1)
      raw.set(key, 1)
      const map = reactive(raw)
      map.set(key, 2)
      expect(
        `Reactive Map contains both the raw and reactive`
      ).toHaveBeenWarned()
    })

    // #877
    it('should not trigger key iteration when setting existing keys', () => {
      const map = reactive(new Map())
      const spy = jest.fn()

      effect(() => {
        const keys = []
        for (const key of map.keys()) {
          keys.push(key)
        }
        spy(keys)
      })

      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0][0]).toMatchObject([])

      map.set('a', 0)
      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy.mock.calls[1][0]).toMatchObject(['a'])

      map.set('b', 0)
      expect(spy).toHaveBeenCalledTimes(3)
      expect(spy.mock.calls[2][0]).toMatchObject(['a', 'b'])

      // keys didn't change, should not trigger
      map.set('b', 1)
      expect(spy).toHaveBeenCalledTimes(3)
    })

    it('should trigger Map.has only once for non-reactive keys', () => {
      const [proxy, spy] = coverCollectionFn(new Map(), 'has')
      proxy.has('k')
      expect(spy).toBeCalledTimes(1)
    })

    it('should trigger Map.set only once for non-reactive keys', () => {
      const [proxy, spy] = coverCollectionFn(new Map(), 'set')
      proxy.set('k', 'v')
      expect(spy).toBeCalledTimes(1)
    })

    it('should trigger Map.delete only once for non-reactive keys', () => {
      const [proxy, spy] = coverCollectionFn(new Map(), 'delete')
      proxy.delete('foo')
      expect(spy).toBeCalledTimes(1)
    })

    it('should trigger Map.clear only once for non-reactive keys', () => {
      const [proxy, spy] = coverCollectionFn(new Map(), 'clear')
      proxy.clear()
      expect(spy).toBeCalledTimes(1)
    })

    it('should return proxy from Map.set call', () => {
      const map = reactive(new Map())
      const result = map.set('a', 'a')
      expect(result).toBe(map)
    })
  })
})
