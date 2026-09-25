import { setFlagsFromString } from 'node:v8'
import { isProxy, isReactive, reactive, readonly } from '../src/reactive'

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
    expect(seen.length).toBe(4)
    expect(seen.every(isProxy)).toBe(true)

    expect(isProtectorIntact()).toBe(true)
  })

  test('should keep native array iterator behavior', () => {
    const iter = reactive([{ val: 1 }, { val: 2 }])[Symbol.iterator]()
    // inherits from the native array iterator
    expect(Object.prototype.toString.call(iter)).toBe('[object Array Iterator]')
    expect(iter[Symbol.iterator]()).toBe(iter)

    const first = iter.next()
    expect(first.done).toBe(false)
    expect(isReactive(first.value)).toBe(true)
    iter.next()
    expect(iter.next()).toEqual({ value: undefined, done: true })
  })
})
