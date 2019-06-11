import { state, isState, toRaw, markNonReactive } from '../src/index'

describe('observer/observable', () => {
  test('Object', () => {
    const original = { foo: 1 }
    const observed = state(original)
    expect(observed).not.toBe(original)
    expect(isState(observed)).toBe(true)
    expect(isState(original)).toBe(false)
    // get
    expect(observed.foo).toBe(1)
    // has
    expect('foo' in observed).toBe(true)
    // ownKeys
    expect(Object.keys(observed)).toEqual(['foo'])
  })

  test('Array', () => {
    const original: any[] = [{ foo: 1 }]
    const observed = state(original)
    expect(observed).not.toBe(original)
    expect(isState(observed)).toBe(true)
    expect(isState(original)).toBe(false)
    expect(isState(observed[0])).toBe(true)
    // get
    expect(observed[0].foo).toBe(1)
    // has
    expect(0 in observed).toBe(true)
    // ownKeys
    expect(Object.keys(observed)).toEqual(['0'])
  })

  test('cloned observable Array should point to observed values', () => {
    const original = [{ foo: 1 }]
    const observed = state(original)
    const clone = observed.slice()
    expect(isState(clone[0])).toBe(true)
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
    const observed = state(original)
    expect(isState(observed.nested)).toBe(true)
    expect(isState(observed.array)).toBe(true)
    expect(isState(observed.array[0])).toBe(true)
  })

  test('observed value should proxy mutations to original (Object)', () => {
    const original: any = { foo: 1 }
    const observed = state(original)
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
    const observed = state(original)
    // set
    const value = { baz: 3 }
    const observableValue = state(value)
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
    const observed: any = state({})
    const raw = {}
    observed.foo = raw
    expect(observed.foo).not.toBe(raw)
    expect(isState(observed.foo)).toBe(true)
  })

  test('observing already observed value should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = state(original)
    const observed2 = state(observed)
    expect(observed2).toBe(observed)
  })

  test('observing the same value multiple times should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = state(original)
    const observed2 = state(original)
    expect(observed2).toBe(observed)
  })

  test('should not pollute original object with Proxies', () => {
    const original: any = { foo: 1 }
    const original2 = { bar: 2 }
    const observed = state(original)
    const observed2 = state(original2)
    observed.bar = observed2
    expect(observed.bar).toBe(observed2)
    expect(original.bar).toBe(original2)
  })

  test('unwrap', () => {
    const original = { foo: 1 }
    const observed = state(original)
    expect(toRaw(observed)).toBe(original)
    expect(toRaw(original)).toBe(original)
  })

  test('unobservable values', () => {
    const warn = jest.spyOn(console, 'warn')
    let lastMsg: string
    warn.mockImplementation(msg => {
      lastMsg = msg
    })

    const getMsg = (value: any) => `value is not observable: ${String(value)}`
    const assertValue = (value: any) => {
      state(value)
      expect(lastMsg).toMatch(getMsg(value))
    }

    // number
    assertValue(1)
    // string
    assertValue('foo')
    // boolean
    assertValue(false)
    // null
    assertValue(null)
    // undefined should work because it returns empty object observable
    lastMsg = ''
    state(undefined)
    expect(lastMsg).toBe('')
    // symbol
    const s = Symbol()
    assertValue(s)

    warn.mockRestore()

    // built-ins should work and return same value
    const p = Promise.resolve()
    expect(state(p)).toBe(p)
    const r = new RegExp('')
    expect(state(r)).toBe(r)
    const d = new Date()
    expect(state(d)).toBe(d)
  })

  test('markNonReactive', () => {
    const obj = state({
      foo: { a: 1 },
      bar: markNonReactive({ b: 2 })
    })
    expect(isState(obj.foo)).toBe(true)
    expect(isState(obj.bar)).toBe(false)
  })
})
