import {
  isReactive,
  isShallow,
  reactive,
  readonly,
  shallowReactive,
  shallowReadonly,
} from '../src/reactive'

import { effect } from '../src/effect'
import { type Ref, isRef, ref } from '../src/ref'

describe('shallowReactive', () => {
  test('should not make non-reactive properties reactive', () => {
    const props = shallowReactive({ n: { foo: 1 } })
    expect(isReactive(props.n)).toBe(false)
  })

  test('should keep reactive properties reactive', () => {
    const props: any = shallowReactive({ n: reactive({ foo: 1 }) })
    props.n = reactive({ foo: 2 })
    expect(isReactive(props.n)).toBe(true)
  })

  // #2843
  test('should allow shallow and normal reactive for same target', () => {
    const original = { foo: {} }
    const shallowProxy = shallowReactive(original)
    const reactiveProxy = reactive(original)
    expect(shallowProxy).not.toBe(reactiveProxy)
    expect(isReactive(shallowProxy.foo)).toBe(false)
    expect(isReactive(reactiveProxy.foo)).toBe(true)
  })

  test.each([{}, [], new Map(), new Set(), new WeakMap(), new WeakSet()])(
    'isShallow (%o)',
    value => {
      expect(isShallow(shallowReactive(value))).toBe(true)
      expect(isShallow(shallowReadonly(value))).toBe(true)
      expect(isShallow(reactive(value))).toBe(false)
      expect(isShallow(readonly(value))).toBe(false)
      expect(isShallow(readonly(shallowReactive(value)))).toBe(false)
      expect(isShallow(shallowReadonly(reactive(value)))).toBe(true)
    },
  )

  // #5271
  test('should respect shallow reactive nested inside reactive on reset', () => {
    const r = reactive({ foo: shallowReactive({ bar: {} }) })
    expect(isShallow(r.foo)).toBe(true)
    expect(isReactive(r.foo.bar)).toBe(false)

    r.foo = shallowReactive({ bar: {} })
    expect(isShallow(r.foo)).toBe(true)
    expect(isReactive(r.foo.bar)).toBe(false)
  })

  // vuejs/vue#12597
  test('should not unwrap refs', () => {
    const foo = shallowReactive({
      bar: ref(123),
    })
    expect(isRef(foo.bar)).toBe(true)
    expect(foo.bar.value).toBe(123)
  })

  // vuejs/vue#12688
  test('should not mutate refs', () => {
    const original = ref(123)
    const foo = shallowReactive<{ bar: Ref<number> | number }>({
      bar: original,
    })
    expect(foo.bar).toBe(original)
    foo.bar = 234
    expect(foo.bar).toBe(234)
    expect(original.value).toBe(123)
  })

  test('should respect shallow/deep versions of same target on access', () => {
    const original = {}
    const shallow = shallowReactive(original)
    const deep = reactive(original)
    const r = reactive({ shallow, deep })
    expect(r.shallow).toBe(shallow)
    expect(r.deep).toBe(deep)
  })

  describe('collections', () => {
    test('should be reactive', () => {
      const shallowSet = shallowReactive(new Set())
      const a = {}
      let size

      effect(() => {
        size = shallowSet.size
      })

      expect(size).toBe(0)

      shallowSet.add(a)
      expect(size).toBe(1)

      shallowSet.delete(a)
      expect(size).toBe(0)
    })

    test('should not observe when iterating', () => {
      const shallowSet = shallowReactive(new Set())
      const a = {}
      shallowSet.add(a)

      const spreadA = [...shallowSet][0]
      expect(isReactive(spreadA)).toBe(false)
    })

    test('should not get reactive entry', () => {
      const shallowMap = shallowReactive(new Map())
      const a = {}
      const key = 'a'

      shallowMap.set(key, a)

      expect(isReactive(shallowMap.get(key))).toBe(false)
    })

    test('should not get reactive on foreach', () => {
      const shallowSet = shallowReactive(new Set())
      const a = {}
      shallowSet.add(a)

      shallowSet.forEach(x => expect(isReactive(x)).toBe(false))
    })

    test('Setting a reactive object on a shallowReactive map', () => {
      const msg = ref('ads')
      const bar = reactive({ msg })
      const foo = shallowReactive(new Map([['foo1', bar]]))
      foo.set('foo2', bar)

      expect(isReactive(foo.get('foo2'))).toBe(true)
      expect(isReactive(foo.get('foo1'))).toBe(true)
    })

    test('Setting a reactive object on a shallowReactive set', () => {
      const msg = ref(1)
      const bar = reactive({ msg })
      const foo = reactive({ msg })

      const deps = shallowReactive(new Set([bar]))
      deps.add(foo)

      deps.forEach(dep => {
        expect(isReactive(dep)).toBe(true)
      })
    })

    // #1210
    test('onTrack on called on objectSpread', () => {
      const onTrackFn = vi.fn()
      const shallowSet = shallowReactive(new Set())
      let a
      effect(
        () => {
          a = Array.from(shallowSet)
        },
        {
          onTrack: onTrackFn,
        },
      )

      expect(a).toMatchObject([])
      expect(onTrackFn).toHaveBeenCalled()
    })
  })

  describe('array', () => {
    test('should be reactive', () => {
      const shallowArray = shallowReactive<unknown[]>([])
      const a = {}
      let size

      effect(() => {
        size = shallowArray.length
      })

      expect(size).toBe(0)

      shallowArray.push(a)
      expect(size).toBe(1)

      shallowArray.pop()
      expect(size).toBe(0)
    })

    test('should not observe when iterating', () => {
      const shallowArray = shallowReactive<object[]>([])
      const a = {}
      shallowArray.push(a)

      const spreadA = [...shallowArray][0]
      expect(isReactive(spreadA)).toBe(false)
    })

    test('onTrack on called on objectSpread', () => {
      const onTrackFn = vi.fn()
      const shallowArray = shallowReactive([])
      let a
      effect(
        () => {
          a = Array.from(shallowArray)
        },
        {
          onTrack: onTrackFn,
        },
      )

      expect(a).toMatchObject([])
      expect(onTrackFn).toHaveBeenCalled()
    })
  })

  test('should preserve shallow collections when assigned to reactive containers', () => {
    const item = {}
    const shallow = shallowReactive(new Map([['item', item]]))
    const state = reactive({ map: new Map() })
    const map = reactive(new Map())
    const set = reactive(new Set())

    state.map = shallow
    map.set('shallow', shallow)
    set.add(shallow)

    expect(state.map).toBe(shallow)
    expect(map.get('shallow')).toBe(shallow)
    expect([...set][0]).toBe(shallow)
    expect(state.map.get('item')).toBe(item)
  })
})
