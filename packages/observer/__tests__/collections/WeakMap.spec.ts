import { observable, autorun, unwrap, isObservable } from '../../src'

describe('observer/collections/WeakMap', () => {
  test('instanceof', () => {
    const original = new WeakMap()
    const observed = observable(original)
    expect(isObservable(observed)).toBe(true)
    expect(original instanceof WeakMap).toBe(true)
    expect(observed instanceof WeakMap).toBe(true)
  })

  it('should observe mutations', () => {
    let dummy
    const key = {}
    const map = observable(new WeakMap())
    autorun(() => {
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
    const map: any = observable(new Map())
    autorun(() => (dummy = map.customProp))

    expect(dummy).toBe(undefined)
    map.customProp = 'Hello World'
    expect(dummy).toBe(undefined)
  })

  it('should not observe non value changing mutations', () => {
    let dummy
    const key = {}
    const map = observable(new Map())
    const mapSpy = jest.fn(() => (dummy = map.get(key)))
    autorun(mapSpy)

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
    map.clear()
    expect(dummy).toBe(undefined)
    expect(mapSpy).toHaveBeenCalledTimes(3)
  })

  it('should not observe raw data', () => {
    let dummy
    const key = {}
    const map = observable(new Map())
    autorun(() => (dummy = unwrap(map).get('key')))

    expect(dummy).toBe(undefined)
    map.set(key, 'Hello')
    expect(dummy).toBe(undefined)
    map.delete(key)
    expect(dummy).toBe(undefined)
  })
})
