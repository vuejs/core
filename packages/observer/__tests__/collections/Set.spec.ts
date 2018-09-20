import { observable, autorun, isObservable, unwrap } from '../../src'

describe('Set', () => {
  it('instanceof', () => {
    const original = new Set()
    const observed = observable(original)
    expect(isObservable(observed)).toBe(true)
    expect(original instanceof Set).toBe(true)
    expect(observed instanceof Set).toBe(true)
  })

  it('should observe mutations', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => (dummy = set.has('value')))

    expect(dummy).toBe(false)
    set.add('value')
    expect(dummy).toBe(true)
    set.delete('value')
    expect(dummy).toBe(false)
  })

  it('should observe for of iteration', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => {
      dummy = 0
      for (let num of set) {
        dummy += num
      }
    })

    expect(dummy).toBe(0)
    set.add(2)
    set.add(1)
    expect(dummy).toBe(3)
    set.delete(2)
    expect(dummy).toBe(1)
    set.clear()
    expect(dummy).toBe(0)
  })

  it('should observe forEach iteration', () => {
    let dummy: any
    const set = observable(new Set())
    autorun(() => {
      dummy = 0
      set.forEach(num => (dummy += num))
    })

    expect(dummy).toBe(0)
    set.add(2)
    set.add(1)
    expect(dummy).toBe(3)
    set.delete(2)
    expect(dummy).toBe(1)
    set.clear()
    expect(dummy).toBe(0)
  })

  it('should observe values iteration', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => {
      dummy = 0
      for (let num of set.values()) {
        dummy += num
      }
    })

    expect(dummy).toBe(0)
    set.add(2)
    set.add(1)
    expect(dummy).toBe(3)
    set.delete(2)
    expect(dummy).toBe(1)
    set.clear()
    expect(dummy).toBe(0)
  })

  it('should observe keys iteration', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => {
      dummy = 0
      for (let num of set.keys()) {
        dummy += num
      }
    })

    expect(dummy).toBe(0)
    set.add(2)
    set.add(1)
    expect(dummy).toBe(3)
    set.delete(2)
    expect(dummy).toBe(1)
    set.clear()
    expect(dummy).toBe(0)
  })

  it('should observe entries iteration', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => {
      dummy = 0
      // eslint-disable-next-line no-unused-vars
      for (let [key, num] of set.entries()) {
        key
        dummy += num
      }
    })

    expect(dummy).toBe(0)
    set.add(2)
    set.add(1)
    expect(dummy).toBe(3)
    set.delete(2)
    expect(dummy).toBe(1)
    set.clear()
    expect(dummy).toBe(0)
  })

  it('should be triggered by clearing', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => (dummy = set.has('key')))

    expect(dummy).toBe(false)
    set.add('key')
    expect(dummy).toBe(true)
    set.clear()
    expect(dummy).toBe(false)
  })

  it('should not observe custom property mutations', () => {
    let dummy
    const set: any = observable(new Set())
    autorun(() => (dummy = set.customProp))

    expect(dummy).toBe(undefined)
    set.customProp = 'Hello World'
    expect(dummy).toBe(undefined)
  })

  it('should observe size mutations', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => (dummy = set.size))

    expect(dummy).toBe(0)
    set.add('value')
    set.add('value2')
    expect(dummy).toBe(2)
    set.delete('value')
    expect(dummy).toBe(1)
    set.clear()
    expect(dummy).toBe(0)
  })

  it('should not observe non value changing mutations', () => {
    let dummy
    const set = observable(new Set())
    const setSpy = jest.fn(() => (dummy = set.has('value')))
    autorun(setSpy)

    expect(dummy).toBe(false)
    expect(setSpy).toHaveBeenCalledTimes(1)
    set.add('value')
    expect(dummy).toBe(true)
    expect(setSpy).toHaveBeenCalledTimes(2)
    set.add('value')
    expect(dummy).toBe(true)
    expect(setSpy).toHaveBeenCalledTimes(2)
    set.delete('value')
    expect(dummy).toBe(false)
    expect(setSpy).toHaveBeenCalledTimes(3)
    set.delete('value')
    expect(dummy).toBe(false)
    expect(setSpy).toHaveBeenCalledTimes(3)
    set.clear()
    expect(dummy).toBe(false)
    expect(setSpy).toHaveBeenCalledTimes(3)
  })

  it('should not observe raw data', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => (dummy = unwrap(set).has('value')))

    expect(dummy).toBe(false)
    set.add('value')
    expect(dummy).toBe(false)
  })

  it('should not observe raw iterations', () => {
    let dummy = 0
    const set = observable(new Set())
    autorun(() => {
      dummy = 0
      for (let [num] of unwrap(set).entries()) {
        dummy += num
      }
      for (let num of unwrap(set).keys()) {
        dummy += num
      }
      for (let num of unwrap(set).values()) {
        dummy += num
      }
      unwrap(set).forEach(num => {
        dummy += num
      })
      for (let num of unwrap(set)) {
        dummy += num
      }
    })

    expect(dummy).toBe(0)
    set.add(2)
    set.add(3)
    expect(dummy).toBe(0)
    set.delete(2)
    expect(dummy).toBe(0)
  })

  it('should not be triggered by raw mutations', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => (dummy = set.has('value')))

    expect(dummy).toBe(false)
    unwrap(set).add('value')
    expect(dummy).toBe(false)
    dummy = true
    unwrap(set).delete('value')
    expect(dummy).toBe(true)
    unwrap(set).clear()
    expect(dummy).toBe(true)
  })

  it('should not observe raw size mutations', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => (dummy = unwrap(set).size))

    expect(dummy).toBe(0)
    set.add('value')
    expect(dummy).toBe(0)
  })

  it('should not be triggered by raw size mutations', () => {
    let dummy
    const set = observable(new Set())
    autorun(() => (dummy = set.size))

    expect(dummy).toBe(0)
    unwrap(set).add('value')
    expect(dummy).toBe(0)
  })

  it('should support objects as key', () => {
    let dummy
    const key = {}
    const set = observable(new Set())
    const setSpy = jest.fn(() => (dummy = set.has(key)))
    autorun(setSpy)

    expect(dummy).toBe(false)
    expect(setSpy).toHaveBeenCalledTimes(1)

    set.add({})
    expect(dummy).toBe(false)
    expect(setSpy).toHaveBeenCalledTimes(1)

    set.add(key)
    expect(dummy).toBe(true)
    expect(setSpy).toHaveBeenCalledTimes(2)
  })
})
