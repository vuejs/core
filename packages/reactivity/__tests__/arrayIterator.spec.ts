import { setFlagsFromString } from 'node:v8'
import {
  isProxy,
  isReactive,
  isReadonly,
  reactive,
  readonly,
} from '../src/reactive'

// kept in its own file: the protector check below must run before anything
// else in the file iterates a reactive array
describe('reactivity/reactive/Array iterator', () => {
  // #15643
  test('iterating should not invalidate V8 array iteration fast paths', () => {
    setFlagsFromString('--allow-natives-syntax')
    const isProtectorIntact = new Function(
      'return %ArrayIteratorProtector()',
    ) as () => boolean
    // the protector is isolate-wide and can only ever be invalidated, so it
    // has to be intact on entry for the check below to mean anything; each
    // test file runs in its own worker, so nothing else can have tripped it
    expect(isProtectorIntact()).toBe(true)

    const seen: unknown[] = []
    const deep = reactive([{ val: 1 }])
    for (const item of deep) seen.push(item)
    for (const item of deep.values()) seen.push(item)
    for (const [, item] of deep.entries()) seen.push(item)
    for (const item of readonly([{ val: 1 }])) seen.push(item)
    for (const item of readonly(deep)) seen.push(item)
    for (const item of readonly(deep).values()) seen.push(item)
    for (const [, item] of readonly(deep).entries()) seen.push(item)
    expect(seen.length).toBe(7)
    expect(seen.every(isProxy)).toBe(true)

    class Items extends Array {
      [Symbol.iterator]() {
        return super[Symbol.iterator]()
      }
      values() {
        return super.values()
      }
      entries() {
        return super.entries()
      }
    }
    const custom = reactive(new Items())
    custom.push({ val: 1 })
    const iter = custom[Symbol.iterator]()
    const values = custom.values()
    const entries = custom.entries()
    expect(isProtectorIntact()).toBe(true)
    expect(isReactive(iter.next().value)).toBe(true)
    expect(isReactive(values.next().value)).toBe(true)
    expect(isReactive(entries.next().value![1])).toBe(true)

    expect(isProtectorIntact()).toBe(true)
  })

  test('should keep native array iterator behavior', () => {
    const iter = reactive([{ val: 1 }, { val: 2 }])[Symbol.iterator]()
    // inherits from the shared native array iterator prototype
    expect(Object.prototype.toString.call(iter)).toBe('[object Array Iterator]')
    expect(iter[Symbol.iterator]()).toBe(iter)

    const first = iter.next()
    expect(first.done).toBe(false)
    expect(isReactive(first.value)).toBe(true)
    iter.next()
    expect(iter.next()).toEqual({ value: undefined, done: true })
  })

  test('should close custom iterators on early exit', () => {
    let closed = false
    class Items extends Array {
      *[Symbol.iterator]() {
        try {
          yield {}
        } finally {
          closed = true
        }
        return undefined
      }
    }

    for (const item of reactive(new Items())) {
      expect(isReactive(item)).toBe(true)
      break
    }
    expect(closed).toBe(true)
  })

  test('should close native iterators returned by custom methods on early exit', () => {
    let closed = false
    class Items extends Array {
      [Symbol.iterator]() {
        const iter = super[Symbol.iterator]()
        iter.return = function () {
          expect(this).toBe(iter)
          closed = true
          return { value: undefined, done: true }
        }
        return iter
      }
    }

    const items = new Items()
    items.push({})
    for (const item of reactive(items)) {
      expect(isReactive(item)).toBe(true)
      break
    }
    expect(closed).toBe(true)
  })

  test('should pass wrapped values to iterator helpers', () => {
    const raw = [{ val: 1 }]
    if (!('map' in raw.values())) return

    class Items extends Array {
      *values() {
        yield* raw
        return undefined
      }
    }
    for (const array of [
      reactive(raw),
      readonly(reactive(raw)),
      reactive(new Items()),
      readonly(reactive(new Items())),
    ]) {
      const iter = array.values()
      // @ts-expect-error iterator helpers are not in es2016
      const mapped = iter.map((item: (typeof raw)[number]) => {
        expect(isReactive(item)).toBe(true)
        expect(isReadonly(item)).toBe(isReadonly(array))
        return item.val
      })
      expect([...mapped]).toEqual([1])
    }
  })
})
