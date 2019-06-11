import { value } from '../src/value'
import { effect, state } from '../src/index'

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
    const obj = state({
      a,
      b: {
        c: a,
        d: [a]
      }
    })
    let dummy1
    let dummy2
    let dummy3
    effect(() => {
      dummy1 = obj.a
      dummy2 = obj.b.c
      dummy3 = obj.b.d[0]
    })
    expect(dummy1).toBe(1)
    expect(dummy2).toBe(1)
    expect(dummy3).toBe(1)
    a.value++
    expect(dummy1).toBe(2)
    expect(dummy2).toBe(2)
    expect(dummy3).toBe(2)
    obj.a++
    expect(dummy1).toBe(3)
    expect(dummy2).toBe(3)
    expect(dummy3).toBe(3)
  })
})
