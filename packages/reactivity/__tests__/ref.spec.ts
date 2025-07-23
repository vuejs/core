import {
  type Ref,
  effect,
  isReactive,
  isRef,
  reactive,
  ref,
  toRef,
  toRefs,
  toValue,
} from '../src/index'
import { computed } from '@vue/runtime-dom'
import { customRef, shallowRef, triggerRef, unref } from '../src/ref'
import {
  isReadonly,
  isShallow,
  readonly,
  shallowReactive,
} from '../src/reactive'

describe('reactivity/ref', () => {
  it('should hold a value', () => {
    const a = ref(1)
    expect(a.value).toBe(1)
    a.value = 2
    expect(a.value).toBe(2)
  })

  it('should be reactive', () => {
    const a = ref(1)
    let dummy
    const fn = vi.fn(() => {
      dummy = a.value
    })
    effect(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(1)
    a.value = 2
    expect(fn).toHaveBeenCalledTimes(2)
    expect(dummy).toBe(2)
    // same value should not trigger
    a.value = 2
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('ref wrapped in reactive should not track internal _value access', () => {
    const a = ref(1)
    const b = reactive(a)
    let dummy
    const fn = vi.fn(() => {
      dummy = b.value // this will observe both b.value and a.value access
    })
    effect(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(1)

    // mutating a.value should only trigger effect once
    a.value = 3
    expect(fn).toHaveBeenCalledTimes(2)
    expect(dummy).toBe(3)

    // mutating b.value should trigger the effect twice. (once for a.value change and once for b.value change)
    b.value = 5
    expect(fn).toHaveBeenCalledTimes(4)
    expect(dummy).toBe(5)
  })

  it('should make nested properties reactive', () => {
    const a = ref({
      count: 1,
    })
    let dummy
    effect(() => {
      dummy = a.value.count
    })
    expect(dummy).toBe(1)
    a.value.count = 2
    expect(dummy).toBe(2)
  })

  it('should work without initial value', () => {
    const a = ref()
    let dummy
    effect(() => {
      dummy = a.value
    })
    expect(dummy).toBe(undefined)
    a.value = 2
    expect(dummy).toBe(2)
  })

  it('should work like a normal property when nested in a reactive object', () => {
    const a = ref(1)
    const obj = reactive({
      a,
      b: {
        c: a,
      },
    })

    let dummy1: number
    let dummy2: number

    effect(() => {
      dummy1 = obj.a
      dummy2 = obj.b.c
    })

    const assertDummiesEqualTo = (val: number) =>
      [dummy1, dummy2].forEach(dummy => expect(dummy).toBe(val))

    assertDummiesEqualTo(1)
    a.value++
    assertDummiesEqualTo(2)
    obj.a++
    assertDummiesEqualTo(3)
    obj.b.c++
    assertDummiesEqualTo(4)
  })

  it('should unwrap nested ref in types', () => {
    const a = ref(0)
    const b = ref(a)

    expect(typeof (b.value + 1)).toBe('number')
  })

  it('should unwrap nested values in types', () => {
    const a = {
      b: ref(0),
    }

    const c = ref(a)

    expect(typeof (c.value.b + 1)).toBe('number')
  })

  it('should NOT unwrap ref types nested inside arrays', () => {
    const arr = ref([1, ref(3)]).value
    expect(isRef(arr[0])).toBe(false)
    expect(isRef(arr[1])).toBe(true)
    expect((arr[1] as Ref).value).toBe(3)
  })

  it('should unwrap ref types as props of arrays', () => {
    const arr = [ref(0)]
    const symbolKey = Symbol('')
    arr['' as any] = ref(1)
    arr[symbolKey as any] = ref(2)
    const arrRef = ref(arr).value
    expect(isRef(arrRef[0])).toBe(true)
    expect(isRef(arrRef['' as any])).toBe(false)
    expect(isRef(arrRef[symbolKey as any])).toBe(false)
    expect(arrRef['' as any]).toBe(1)
    expect(arrRef[symbolKey as any]).toBe(2)
  })

  it('should keep tuple types', () => {
    const tuple: [number, string, { a: number }, () => number, Ref<number>] = [
      0,
      '1',
      { a: 1 },
      () => 0,
      ref(0),
    ]
    const tupleRef = ref(tuple)

    tupleRef.value[0]++
    expect(tupleRef.value[0]).toBe(1)
    tupleRef.value[1] += '1'
    expect(tupleRef.value[1]).toBe('11')
    tupleRef.value[2].a++
    expect(tupleRef.value[2].a).toBe(2)
    expect(tupleRef.value[3]()).toBe(0)
    tupleRef.value[4].value++
    expect(tupleRef.value[4].value).toBe(1)
  })

  it('should keep symbols', () => {
    const customSymbol = Symbol()
    const obj = {
      [Symbol.asyncIterator]: ref(1),
      [Symbol.hasInstance]: { a: ref('a') },
      [Symbol.isConcatSpreadable]: { b: ref(true) },
      [Symbol.iterator]: [ref(1)],
      [Symbol.match]: new Set<Ref<number>>(),
      [Symbol.matchAll]: new Map<number, Ref<string>>(),
      [Symbol.replace]: { arr: [ref('a')] },
      [Symbol.search]: { set: new Set<Ref<number>>() },
      [Symbol.species]: { map: new Map<number, Ref<string>>() },
      [Symbol.split]: new WeakSet<Ref<boolean>>(),
      [Symbol.toPrimitive]: new WeakMap<Ref<boolean>, string>(),
      [Symbol.toStringTag]: { weakSet: new WeakSet<Ref<boolean>>() },
      [Symbol.unscopables]: { weakMap: new WeakMap<Ref<boolean>, string>() },
      [customSymbol]: { arr: [ref(1)] },
    }

    const objRef = ref(obj)

    const keys: (keyof typeof obj)[] = [
      Symbol.asyncIterator,
      Symbol.hasInstance,
      Symbol.isConcatSpreadable,
      Symbol.iterator,
      Symbol.match,
      Symbol.matchAll,
      Symbol.replace,
      Symbol.search,
      Symbol.species,
      Symbol.split,
      Symbol.toPrimitive,
      Symbol.toStringTag,
      Symbol.unscopables,
      customSymbol,
    ]

    keys.forEach(key => {
      expect(objRef.value[key]).toStrictEqual(obj[key])
    })
  })

  test('unref', () => {
    expect(unref(1)).toBe(1)
    expect(unref(ref(1))).toBe(1)
  })

  test('shallowRef', () => {
    const sref = shallowRef({ a: 1 })
    expect(isReactive(sref.value)).toBe(false)

    let dummy
    effect(() => {
      dummy = sref.value.a
    })
    expect(dummy).toBe(1)

    sref.value = { a: 2 }
    expect(isReactive(sref.value)).toBe(false)
    expect(dummy).toBe(2)
  })

  test('shallowRef force trigger', () => {
    const sref = shallowRef({ a: 1 })
    let dummy
    effect(() => {
      dummy = sref.value.a
    })
    expect(dummy).toBe(1)

    sref.value.a = 2
    expect(dummy).toBe(1) // should not trigger yet

    // force trigger
    triggerRef(sref)
    expect(dummy).toBe(2)
  })

  test('shallowRef isShallow', () => {
    expect(isShallow(shallowRef({ a: 1 }))).toBe(true)
  })

  test('isRef', () => {
    expect(isRef(ref(1))).toBe(true)
    expect(isRef(computed(() => 1))).toBe(true)

    expect(isRef(0)).toBe(false)
    expect(isRef(1)).toBe(false)
    // an object that looks like a ref isn't necessarily a ref
    expect(isRef({ value: 0 })).toBe(false)
  })

  test('toRef', () => {
    const a = reactive({
      x: 1,
    })
    const x = toRef(a, 'x')

    const b = ref({ y: 1 })

    const c = toRef(b)

    const d = toRef({ z: 1 })

    expect(isRef(d)).toBe(true)
    expect(d.value.z).toBe(1)

    expect(c).toBe(b)

    expect(isRef(x)).toBe(true)
    expect(x.value).toBe(1)

    // source -> proxy
    a.x = 2
    expect(x.value).toBe(2)

    // proxy -> source
    x.value = 3
    expect(a.x).toBe(3)

    // reactivity
    let dummyX
    effect(() => {
      dummyX = x.value
    })
    expect(dummyX).toBe(x.value)

    // mutating source should trigger effect using the proxy refs
    a.x = 4
    expect(dummyX).toBe(4)

    // should keep ref
    const r = { x: ref(1) }
    expect(toRef(r, 'x')).toBe(r.x)
  })

  test('toRef on array', () => {
    const a = reactive(['a', 'b'])
    const r = toRef(a, 1)
    expect(r.value).toBe('b')
    r.value = 'c'
    expect(r.value).toBe('c')
    expect(a[1]).toBe('c')
  })

  test('toRef default value', () => {
    const a: { x: number | undefined } = { x: undefined }
    const x = toRef(a, 'x', 1)
    expect(x.value).toBe(1)

    a.x = 2
    expect(x.value).toBe(2)

    a.x = undefined
    expect(x.value).toBe(1)
  })

  test('toRef getter', () => {
    const x = toRef(() => 1)
    expect(x.value).toBe(1)
    expect(isRef(x)).toBe(true)
    expect(unref(x)).toBe(1)
    //@ts-expect-error
    expect(() => (x.value = 123)).toThrow()

    expect(isReadonly(x)).toBe(true)
  })

  test('toRefs', () => {
    const a = reactive({
      x: 1,
      y: 2,
    })

    const { x, y } = toRefs(a)

    expect(isRef(x)).toBe(true)
    expect(isRef(y)).toBe(true)
    expect(x.value).toBe(1)
    expect(y.value).toBe(2)

    // source -> proxy
    a.x = 2
    a.y = 3
    expect(x.value).toBe(2)
    expect(y.value).toBe(3)

    // proxy -> source
    x.value = 3
    y.value = 4
    expect(a.x).toBe(3)
    expect(a.y).toBe(4)

    // reactivity
    let dummyX, dummyY
    effect(() => {
      dummyX = x.value
      dummyY = y.value
    })
    expect(dummyX).toBe(x.value)
    expect(dummyY).toBe(y.value)

    // mutating source should trigger effect using the proxy refs
    a.x = 4
    a.y = 5
    expect(dummyX).toBe(4)
    expect(dummyY).toBe(5)
  })

  test('toRefs should warn on plain object', () => {
    toRefs({})
    expect(`toRefs() expects a reactive object`).toHaveBeenWarned()
  })

  test('toRefs should warn on plain array', () => {
    toRefs([])
    expect(`toRefs() expects a reactive object`).toHaveBeenWarned()
  })

  test('toRefs reactive array', () => {
    const arr = reactive(['a', 'b', 'c'])
    const refs = toRefs(arr)

    expect(Array.isArray(refs)).toBe(true)

    refs[0].value = '1'
    expect(arr[0]).toBe('1')

    arr[1] = '2'
    expect(refs[1].value).toBe('2')
  })

  test('customRef', () => {
    let value = 1
    let _trigger: () => void

    const custom = customRef((track, trigger) => ({
      get() {
        track()
        return value
      },
      set(newValue: number) {
        value = newValue
        _trigger = trigger
      },
    }))

    expect(isRef(custom)).toBe(true)

    let dummy
    effect(() => {
      dummy = custom.value
    })
    expect(dummy).toBe(1)

    custom.value = 2
    // should not trigger yet
    expect(dummy).toBe(1)

    _trigger!()
    expect(dummy).toBe(2)
  })

  test('should not trigger when setting value to same proxy', () => {
    const obj = reactive({ count: 0 })

    const a = ref(obj)
    const spy1 = vi.fn(() => a.value)

    effect(spy1)

    a.value = obj
    expect(spy1).toBeCalledTimes(1)

    const b = shallowRef(obj)
    const spy2 = vi.fn(() => b.value)

    effect(spy2)

    b.value = obj
    expect(spy2).toBeCalledTimes(1)
  })

  test('ref should preserve value shallow/readonly-ness', () => {
    const original = {}
    const r = reactive(original)
    const s = shallowReactive(original)
    const rr = readonly(original)
    const a = ref(original)

    expect(a.value).toBe(r)

    a.value = s
    expect(a.value).toBe(s)
    expect(a.value).not.toBe(r)

    a.value = rr
    expect(a.value).toBe(rr)
    expect(a.value).not.toBe(r)
  })

  test('should not trigger when setting the same raw object', () => {
    const obj = {}
    const r = ref(obj)
    const spy = vi.fn()
    effect(() => spy(r.value))
    expect(spy).toHaveBeenCalledTimes(1)

    r.value = obj
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('toValue', () => {
    const a = ref(1)
    const b = computed(() => a.value + 1)
    const c = () => a.value + 2
    const d = 4

    expect(toValue(a)).toBe(1)
    expect(toValue(b)).toBe(2)
    expect(toValue(c)).toBe(3)
    expect(toValue(d)).toBe(4)
  })

  test('ref w/ customRef w/ getterRef w/ objectRef should store value cache', () => {
    const refValue = ref(1)
    // @ts-expect-error private field
    expect(refValue._value).toBe(1)

    let customRefValueCache = 0
    const customRefValue = customRef((track, trigger) => {
      return {
        get() {
          track()
          return customRefValueCache
        },
        set(value: number) {
          customRefValueCache = value
          trigger()
        },
      }
    })
    customRefValue.value

    // @ts-expect-error internal field
    expect(customRefValue._value).toBe(0)

    const getterRefValue = toRef(() => 1)
    getterRefValue.value
    // @ts-expect-error internal field
    expect(getterRefValue._value).toBe(1)

    const objectRefValue = toRef({ value: 1 }, 'value')
    objectRefValue.value
    // @ts-expect-error internal field
    expect(objectRefValue._value).toBe(1)
  })
})
