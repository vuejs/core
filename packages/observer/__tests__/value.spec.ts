import { value } from '../src/value'
import { effect, observable } from '../src/index'

describe('observer/value', () => {
  it('should hold a value', () => {
    const a = value(1)
    expect(a.value).toBe(1)
    a.value = 2
    expect(a.value).toBe(2)
  })

  it('should be reactive', () => {
    const a = value(1)
    let dummy
    effect(() => {
      dummy = a.value
    })
    expect(dummy).toBe(1)
    a.value = 2
    expect(dummy).toBe(2)
  })

  it('should make nested properties reactive', () => {
    const a = value({
      count: 1
    })
    let dummy
    effect(() => {
      dummy = a.value.count
    })
    expect(dummy).toBe(1)
    a.value.count = 2
    expect(dummy).toBe(2)
  })

  it('should work like a normal property when nested in an observable', () => {
    const a = value(1)
    const obj = observable({
      a,
      b: {
        c: a
      }
    })
    let dummy
    effect(() => {
      dummy = obj.a
    })
    expect(dummy).toBe(1)
    a.value++
    expect(dummy).toBe(2)
    obj.a++
    expect(dummy).toBe(3)
  })
})
