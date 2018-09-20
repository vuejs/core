import { observable, isObservable, unwrap, markNonReactive } from '../src/index'

describe('observer/observable', () => {
  test('Object', () => {
    const original = { foo: 1 }
    const observed = observable(original)
    expect(observed).not.toBe(original)
    expect(isObservable(observed)).toBe(true)
    expect(isObservable(original)).toBe(false)
    // get
    expect(observed.foo).toBe(1)
    // has
    expect('foo' in observed).toBe(true)
    // ownKeys
    expect(Object.keys(observed)).toEqual(['foo'])
  })

  test('Array', () => {
    const original: any[] = [{ foo: 1 }]
    const observed = observable(original)
    expect(observed).not.toBe(original)
    expect(isObservable(observed)).toBe(true)
    expect(isObservable(original)).toBe(false)
    expect(isObservable(observed[0])).toBe(true)
    // get
    expect(observed[0].foo).toBe(1)
    // has
    expect(0 in observed).toBe(true)
    // ownKeys
    expect(Object.keys(observed)).toEqual(['0'])
  })

  test('cloned observable Array should point to observed values', () => {
    const original = [{ foo: 1 }]
    const observed = observable(original)
    const clone = observed.slice()
    expect(isObservable(clone[0])).toBe(true)
    expect(clone[0]).not.toBe(original[0])
    expect(clone[0]).toBe(observed[0])
  })

  test('nested observables', () => {
    const original = {
      nested: {
        foo: 1
      },
      array: [{ bar: 2 }]
    }
    const observed = observable(original)
    expect(isObservable(observed.nested)).toBe(true)
    expect(isObservable(observed.array)).toBe(true)
    expect(isObservable(observed.array[0])).toBe(true)
  })

  test('observed value should proxy mutations to original (Object)', () => {
    const original: any = { foo: 1 }
    const observed = observable(original)
    // set
    observed.bar = 1
    expect(observed.bar).toBe(1)
    expect(original.bar).toBe(1)
    // delete
    delete observed.foo
    expect('foo' in observed).toBe(false)
    expect('foo' in original).toBe(false)
  })

  test('observed value should proxy mutations to original (Array)', () => {
    const original: any[] = [{ foo: 1 }, { bar: 2 }]
    const observed = observable(original)
    // set
    const value = { baz: 3 }
    const observableValue = observable(value)
    observed[0] = value
    expect(observed[0]).toBe(observableValue)
    expect(original[0]).toBe(value)
    // delete
    delete observed[0]
    expect(observed[0]).toBeUndefined()
    expect(original[0]).toBeUndefined()
    // mutating methods
    observed.push(value)
    expect(observed[2]).toBe(observableValue)
    expect(original[2]).toBe(value)
  })

  test('setting a property with an unobserved value should wrap with observable', () => {
    const observed: any = observable({})
    const raw = {}
    observed.foo = raw
    expect(observed.foo).not.toBe(raw)
    expect(isObservable(observed.foo)).toBe(true)
  })

  test('observing already observed value should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = observable(original)
    const observed2 = observable(observed)
    expect(observed2).toBe(observed)
  })

  test('observing the same value multiple times should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = observable(original)
    const observed2 = observable(original)
    expect(observed2).toBe(observed)
  })

  test('should not pollute original object with Proxies', () => {
    const original: any = { foo: 1 }
    const original2 = { bar: 2 }
    const observed = observable(original)
    const observed2 = observable(original2)
    observed.bar = observed2
    expect(observed.bar).toBe(observed2)
    expect(original.bar).toBe(original2)
  })

  test('unwrap', () => {
    const original = { foo: 1 }
    const observed = observable(original)
    expect(unwrap(observed)).toBe(original)
    expect(unwrap(original)).toBe(original)
  })

  test('unobservable values', () => {
    const msg = 'not observable'
    // number
    expect(() => observable(1)).toThrowError(msg)
    // string
    expect(() => observable('foo')).toThrowError(msg)
    // boolean
    expect(() => observable(false)).toThrowError(msg)
    // null
    expect(() => observable(null)).toThrowError(msg)
    // undefined should work because it returns empty object observable
    expect(() => observable(undefined)).not.toThrowError(msg)
    // symbol
    const s = Symbol()
    expect(() => observable(s)).toThrowError(msg)
    // built-ins should work and return same value
    const p = Promise.resolve()
    expect(observable(p)).toBe(p)
    const r = new RegExp('')
    expect(observable(r)).toBe(r)
    const d = new Date()
    expect(observable(d)).toBe(d)
  })

  test('markNonReactive', () => {
    const obj = observable({
      foo: { a: 1 },
      bar: markNonReactive({ b: 2 })
    })
    expect(isObservable(obj.foo)).toBe(true)
    expect(isObservable(obj.bar)).toBe(false)
  })
})
