import { type ComputedRef, computed } from '../src/computed'
import { isReactive, reactive, shallowReactive, toRaw } from '../src/reactive'
import { isRef, ref } from '../src/ref'
import { effect } from '../src/effect'

describe('reactivity/reactive/Array', () => {
  test('should make Array reactive', () => {
    const original = [{ foo: 1 }]
    const observed = reactive(original)
    expect(observed).not.toBe(original)
    expect(isReactive(observed)).toBe(true)
    expect(isReactive(original)).toBe(false)
    expect(isReactive(observed[0])).toBe(true)
    // get
    expect(observed[0].foo).toBe(1)
    // has
    expect(0 in observed).toBe(true)
    // ownKeys
    expect(Object.keys(observed)).toEqual(['0'])
  })

  test('cloned reactive Array should point to observed values', () => {
    const original = [{ foo: 1 }]
    const observed = reactive(original)
    const clone = observed.slice()
    expect(isReactive(clone[0])).toBe(true)
    expect(clone[0]).not.toBe(original[0])
    expect(clone[0]).toBe(observed[0])
  })

  test('observed value should proxy mutations to original (Array)', () => {
    const original: any[] = [{ foo: 1 }, { bar: 2 }]
    const observed = reactive(original)
    // set
    const value = { baz: 3 }
    const reactiveValue = reactive(value)
    observed[0] = value
    expect(observed[0]).toBe(reactiveValue)
    expect(original[0]).toBe(value)
    // delete
    delete observed[0]
    expect(observed[0]).toBeUndefined()
    expect(original[0]).toBeUndefined()
    // mutating methods
    observed.push(value)
    expect(observed[2]).toBe(reactiveValue)
    expect(original[2]).toBe(value)
  })

  test('Array identity methods should work with raw values', () => {
    const raw = {}
    const arr = reactive([{}, {}])
    arr.push(raw)

    expect(arr.indexOf(raw)).toBe(2)
    expect(arr.indexOf(raw, 3)).toBe(-1)
    expect(arr.includes(raw)).toBe(true)
    expect(arr.includes(raw, 3)).toBe(false)
    expect(arr.lastIndexOf(raw)).toBe(2)
    expect(arr.lastIndexOf(raw, 1)).toBe(-1)

    // should work also for the observed version
    const observed = arr[2]
    expect(arr.indexOf(observed)).toBe(2)
    expect(arr.indexOf(observed, 3)).toBe(-1)
    expect(arr.includes(observed)).toBe(true)
    expect(arr.includes(observed, 3)).toBe(false)
    expect(arr.lastIndexOf(observed)).toBe(2)
    expect(arr.lastIndexOf(observed, 1)).toBe(-1)
  })

  test('Array identity methods should work if raw value contains reactive objects', () => {
    const raw = []
    const obj = reactive({})
    raw.push(obj)
    const arr = reactive(raw)
    expect(arr.includes(obj)).toBe(true)
  })

  test('Array identity methods should be reactive', () => {
    const obj = {}
    const arr = reactive([obj, {}])

    let index: number = -1
    effect(() => {
      index = arr.indexOf(obj)
    })
    expect(index).toBe(0)
    arr.reverse()
    expect(index).toBe(1)
  })

  // only non-existent reactive will try to search by using its raw value
  describe('Array identity methods should not be called more than necessary', () => {
    const identityMethods = ['includes', 'indexOf', 'lastIndexOf'] as const

    function instrumentArr(rawTarget: any[]) {
      identityMethods.forEach(key => {
        const spy = vi.fn(rawTarget[key] as any)
        rawTarget[key] = spy
      })
    }

    function searchValue(target: any[], ...args: unknown[]) {
      return identityMethods.map(key => (target[key] as any)(...args))
    }

    function unInstrumentArr(rawTarget: any[]) {
      identityMethods.forEach(key => {
        ;(rawTarget[key] as any).mockClear()
        // relink to prototype method
        rawTarget[key] = Array.prototype[key] as any
      })
    }

    function expectHaveBeenCalledTimes(rawTarget: any[], times: number) {
      identityMethods.forEach(key => {
        expect(rawTarget[key]).toHaveBeenCalledTimes(times)
      })
    }

    test('should be called once with a non-existent raw value', () => {
      const reactiveArr = reactive([])
      instrumentArr(toRaw(reactiveArr))
      const searchResult = searchValue(reactiveArr, {})

      expectHaveBeenCalledTimes(toRaw(reactiveArr), 1)
      expect(searchResult).toStrictEqual([false, -1, -1])

      unInstrumentArr(toRaw(reactiveArr))
    })

    test('should be called once with an existent reactive value', () => {
      const existReactiveValue = reactive({})
      const reactiveArr = reactive([existReactiveValue, existReactiveValue])

      instrumentArr(toRaw(reactiveArr))
      const searchResult = searchValue(reactiveArr, existReactiveValue)

      expectHaveBeenCalledTimes(toRaw(reactiveArr), 1)
      expect(searchResult).toStrictEqual([true, 0, 1])

      unInstrumentArr(toRaw(reactiveArr))
    })

    test('should be called twice with a non-existent reactive value', () => {
      const reactiveArr = reactive([])
      instrumentArr(toRaw(reactiveArr))
      const searchResult = searchValue(reactiveArr, reactive({}))

      expectHaveBeenCalledTimes(toRaw(reactiveArr), 2)
      expect(searchResult).toStrictEqual([false, -1, -1])

      unInstrumentArr(toRaw(reactiveArr))
    })

    test('should be called twice with a non-existent reactive value, but the raw value exists', () => {
      const existRaw = {}
      const reactiveArr = reactive([existRaw, existRaw])

      instrumentArr(toRaw(reactiveArr))
      const searchResult = searchValue(reactiveArr, reactive(existRaw))

      expectHaveBeenCalledTimes(toRaw(reactiveArr), 2)
      expect(searchResult).toStrictEqual([true, 0, 1])

      unInstrumentArr(toRaw(reactiveArr))
    })
  })

  test('delete on Array should not trigger length dependency', () => {
    const arr = reactive([1, 2, 3])
    const fn = vi.fn()
    effect(() => {
      fn(arr.length)
    })
    expect(fn).toHaveBeenCalledTimes(1)
    delete arr[1]
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('should track hasOwnProperty call with index', () => {
    const original = [1, 2, 3]
    const observed = reactive(original)

    let dummy
    effect(() => {
      dummy = observed.hasOwnProperty(0)
    })

    expect(dummy).toBe(true)

    delete observed[0]
    expect(dummy).toBe(false)
  })

  test('shift on Array should trigger dependency once', () => {
    const arr = reactive([1, 2, 3])
    const fn = vi.fn()
    effect(() => {
      for (let i = 0; i < arr.length; i++) {
        arr[i]
      }
      fn()
    })
    expect(fn).toHaveBeenCalledTimes(1)
    arr.shift()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  //#6018
  test('edge case: avoid trigger effect in deleteProperty when array length-decrease mutation methods called', () => {
    const arr = ref([1])
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    effect(() => {
      fn1()
      if (arr.value.length > 0) {
        arr.value.slice()
        fn2()
      }
    })
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    arr.value.splice(0)
    expect(fn1).toHaveBeenCalledTimes(2)
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  test('add existing index on Array should not trigger length dependency', () => {
    const array = new Array(3)
    const observed = reactive(array)
    const fn = vi.fn()
    effect(() => {
      fn(observed.length)
    })
    expect(fn).toHaveBeenCalledTimes(1)
    observed[1] = 1
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('add non-integer prop on Array should not trigger length dependency', () => {
    const array: any[] & { x?: string } = new Array(3)
    const observed = reactive(array)
    const fn = vi.fn()
    effect(() => {
      fn(observed.length)
    })
    expect(fn).toHaveBeenCalledTimes(1)
    observed.x = 'x'
    expect(fn).toHaveBeenCalledTimes(1)
    observed[-1] = 'x'
    expect(fn).toHaveBeenCalledTimes(1)
    observed[NaN] = 'x'
    expect(fn).toHaveBeenCalledTimes(1)
  })

  // #2427
  test('track length on for ... in iteration', () => {
    const array = reactive([1])
    let length = ''
    effect(() => {
      length = ''
      for (const key in array) {
        length += key
      }
    })
    expect(length).toBe('0')
    array.push(1)
    expect(length).toBe('01')
  })

  // #9742
  test('mutation on user proxy of reactive Array', () => {
    const array = reactive<number[]>([])
    const proxy = new Proxy(array, {})
    proxy.push(1)
    expect(array).toHaveLength(1)
    expect(proxy).toHaveLength(1)
  })

  describe('Array methods w/ refs', () => {
    let original: any[]
    beforeEach(() => {
      original = reactive([1, ref(2)])
    })

    // read + copy
    test('read only copy methods', () => {
      const raw = original.concat([3, ref(4)])
      expect(isRef(raw[1])).toBe(true)
      expect(isRef(raw[3])).toBe(true)
    })

    // read + write
    test('read + write mutating methods', () => {
      const res = original.copyWithin(0, 1, 2)
      const raw = toRaw(res)
      expect(isRef(raw[0])).toBe(true)
      expect(isRef(raw[1])).toBe(true)
    })

    test('read + identity', () => {
      const ref = original[1]
      expect(ref).toBe(toRaw(original)[1])
      expect(original.indexOf(ref)).toBe(1)
    })
  })

  describe('Array subclasses', () => {
    class SubArray<T> extends Array<T> {
      lastPushed: undefined | T
      lastSearched: undefined | T

      push(item: T) {
        this.lastPushed = item
        return super.push(item)
      }

      indexOf(searchElement: T, fromIndex?: number | undefined): number {
        this.lastSearched = searchElement
        return super.indexOf(searchElement, fromIndex)
      }
    }

    test('calls correct mutation method on Array subclass', () => {
      const subArray = new SubArray(4, 5, 6)
      const observed = reactive(subArray)

      subArray.push(7)
      expect(subArray.lastPushed).toBe(7)
      observed.push(9)
      expect(observed.lastPushed).toBe(9)
    })

    test('calls correct identity-sensitive method on Array subclass', () => {
      const subArray = new SubArray(4, 5, 6)
      const observed = reactive(subArray)
      let index

      index = subArray.indexOf(4)
      expect(index).toBe(0)
      expect(subArray.lastSearched).toBe(4)

      index = observed.indexOf(6)
      expect(index).toBe(2)
      expect(observed.lastSearched).toBe(6)
    })
  })

  describe('Optimized array methods:', () => {
    test('iterator', () => {
      const shallow = shallowReactive([1, 2, 3, 4])
      let result = computed(() => {
        let sum = 0
        for (let x of shallow) {
          sum += x ** 2
        }
        return sum
      })
      expect(result.value).toBe(30)

      shallow[2] = 0
      expect(result.value).toBe(21)

      const deep = reactive([{ val: 1 }, { val: 2 }])
      result = computed(() => {
        let sum = 0
        for (let x of deep) {
          sum += x.val ** 2
        }
        return sum
      })
      expect(result.value).toBe(5)

      deep[1].val = 3
      expect(result.value).toBe(10)
    })

    test('concat', () => {
      const a1 = shallowReactive([1, { val: 2 }])
      const a2 = reactive([{ val: 3 }])
      const a3 = [4, 5]

      let result = computed(() => a1.concat(a2, a3, 6, { val: 7 }))
      expect(result.value).toStrictEqual([
        1,
        { val: 2 },
        { val: 3 },
        4,
        5,
        6,
        { val: 7 },
      ])
      expect(isReactive(result.value[1])).toBe(false)
      expect(isReactive(result.value[2])).toBe(true)
      expect(isReactive(result.value[6])).toBe(false)

      a1.shift()
      expect(result.value).toStrictEqual([
        { val: 2 },
        { val: 3 },
        4,
        5,
        6,
        { val: 7 },
      ])

      a2.pop()
      expect(result.value).toStrictEqual([{ val: 2 }, 4, 5, 6, { val: 7 }])

      a3.pop()
      expect(result.value).toStrictEqual([{ val: 2 }, 4, 5, 6, { val: 7 }])
    })

    test('entries', () => {
      const shallow = shallowReactive([0, 1])
      const result1 = computed(() => Array.from(shallow.entries()))
      expect(result1.value).toStrictEqual([
        [0, 0],
        [1, 1],
      ])

      shallow[1] = 10
      expect(result1.value).toStrictEqual([
        [0, 0],
        [1, 10],
      ])

      const deep = reactive([{ val: 0 }, { val: 1 }])
      const result2 = computed(() => Array.from(deep.entries()))
      expect(result2.value).toStrictEqual([
        [0, { val: 0 }],
        [1, { val: 1 }],
      ])
      expect(isReactive(result2.value[0][1])).toBe(true)

      deep.pop()
      expect(Array.from(result2.value)).toStrictEqual([[0, { val: 0 }]])
    })

    test('every', () => {
      const shallow = shallowReactive([1, 2, 5])
      let result = computed(() => shallow.every(x => x < 5))
      expect(result.value).toBe(false)

      shallow.pop()
      expect(result.value).toBe(true)

      const deep = reactive([{ val: 1 }, { val: 5 }])
      result = computed(() => deep.every(x => x.val < 5))
      expect(result.value).toBe(false)

      deep[1].val = 2
      expect(result.value).toBe(true)
    })

    test('filter', () => {
      const shallow = shallowReactive([1, 2, 3, 4])
      const result1 = computed(() => shallow.filter(x => x < 3))
      expect(result1.value).toStrictEqual([1, 2])

      shallow[2] = 0
      expect(result1.value).toStrictEqual([1, 2, 0])

      const deep = reactive([{ val: 1 }, { val: 2 }])
      const result2 = computed(() => deep.filter(x => x.val < 2))
      expect(result2.value).toStrictEqual([{ val: 1 }])
      expect(isReactive(result2.value[0])).toBe(true)

      deep[1].val = 0
      expect(result2.value).toStrictEqual([{ val: 1 }, { val: 0 }])
    })

    test('find and co.', () => {
      const shallow = shallowReactive([{ val: 1 }, { val: 2 }])
      let find = computed(() => shallow.find(x => x.val === 2))
      // @ts-expect-error tests are not limited to es2016
      let findLast = computed(() => shallow.findLast(x => x.val === 2))
      let findIndex = computed(() => shallow.findIndex(x => x.val === 2))
      let findLastIndex = computed(() =>
        // @ts-expect-error tests are not limited to es2016
        shallow.findLastIndex(x => x.val === 2),
      )

      expect(find.value).toBe(shallow[1])
      expect(isReactive(find.value)).toBe(false)
      expect(findLast.value).toBe(shallow[1])
      expect(isReactive(findLast.value)).toBe(false)
      expect(findIndex.value).toBe(1)
      expect(findLastIndex.value).toBe(1)

      shallow[1].val = 0

      expect(find.value).toBe(shallow[1])
      expect(findLast.value).toBe(shallow[1])
      expect(findIndex.value).toBe(1)
      expect(findLastIndex.value).toBe(1)

      shallow.pop()

      expect(find.value).toBe(undefined)
      expect(findLast.value).toBe(undefined)
      expect(findIndex.value).toBe(-1)
      expect(findLastIndex.value).toBe(-1)

      const deep = reactive([{ val: 1 }, { val: 2 }])
      find = computed(() => deep.find(x => x.val === 2))
      // @ts-expect-error tests are not limited to es2016
      findLast = computed(() => deep.findLast(x => x.val === 2))
      findIndex = computed(() => deep.findIndex(x => x.val === 2))
      // @ts-expect-error tests are not limited to es2016
      findLastIndex = computed(() => deep.findLastIndex(x => x.val === 2))

      expect(find.value).toBe(deep[1])
      expect(isReactive(find.value)).toBe(true)
      expect(findLast.value).toBe(deep[1])
      expect(isReactive(findLast.value)).toBe(true)
      expect(findIndex.value).toBe(1)
      expect(findLastIndex.value).toBe(1)

      deep[1].val = 0

      expect(find.value).toBe(undefined)
      expect(findLast.value).toBe(undefined)
      expect(findIndex.value).toBe(-1)
      expect(findLastIndex.value).toBe(-1)
    })

    test('forEach', () => {
      const shallow = shallowReactive([1, 2, 3, 4])
      let result = computed(() => {
        let sum = 0
        shallow.forEach(x => (sum += x ** 2))
        return sum
      })
      expect(result.value).toBe(30)

      shallow[2] = 0
      expect(result.value).toBe(21)

      const deep = reactive([{ val: 1 }, { val: 2 }])
      result = computed(() => {
        let sum = 0
        deep.forEach(x => (sum += x.val ** 2))
        return sum
      })
      expect(result.value).toBe(5)

      deep[1].val = 3
      expect(result.value).toBe(10)
    })

    test('join', () => {
      function toString(this: { val: number }) {
        return this.val
      }
      const shallow = shallowReactive([
        { val: 1, toString },
        { val: 2, toString },
      ])
      let result = computed(() => shallow.join('+'))
      expect(result.value).toBe('1+2')

      shallow[1].val = 23
      expect(result.value).toBe('1+2')

      shallow.pop()
      expect(result.value).toBe('1')

      const deep = reactive([
        { val: 1, toString },
        { val: 2, toString },
      ])
      result = computed(() => deep.join())
      expect(result.value).toBe('1,2')

      deep[1].val = 23
      expect(result.value).toBe('1,23')
    })

    test('map', () => {
      const shallow = shallowReactive([1, 2, 3, 4])
      let result = computed(() => shallow.map(x => x ** 2))
      expect(result.value).toStrictEqual([1, 4, 9, 16])

      shallow[2] = 0
      expect(result.value).toStrictEqual([1, 4, 0, 16])

      const deep = reactive([{ val: 1 }, { val: 2 }])
      result = computed(() => deep.map(x => x.val ** 2))
      expect(result.value).toStrictEqual([1, 4])

      deep[1].val = 3
      expect(result.value).toStrictEqual([1, 9])
    })

    test('reduce left and right', () => {
      function toString(this: any) {
        return this.val + '-'
      }
      const shallow = shallowReactive([
        { val: 1, toString },
        { val: 2, toString },
      ] as any[])

      expect(shallow.reduce((acc, x) => acc + '' + x.val, undefined)).toBe(
        'undefined12',
      )

      let left = computed(() => shallow.reduce((acc, x) => acc + '' + x.val))
      let right = computed(() =>
        shallow.reduceRight((acc, x) => acc + '' + x.val),
      )
      expect(left.value).toBe('1-2')
      expect(right.value).toBe('2-1')

      shallow[1].val = 23
      expect(left.value).toBe('1-2')
      expect(right.value).toBe('2-1')

      shallow.pop()
      expect(left.value).toBe(shallow[0])
      expect(right.value).toBe(shallow[0])

      const deep = reactive([{ val: 1 }, { val: 2 }])
      left = computed(() => deep.reduce((acc, x) => acc + x.val, '0'))
      right = computed(() => deep.reduceRight((acc, x) => acc + x.val, '3'))
      expect(left.value).toBe('012')
      expect(right.value).toBe('321')

      deep[1].val = 23
      expect(left.value).toBe('0123')
      expect(right.value).toBe('3231')
    })

    test('some', () => {
      const shallow = shallowReactive([1, 2, 5])
      let result = computed(() => shallow.some(x => x > 4))
      expect(result.value).toBe(true)

      shallow.pop()
      expect(result.value).toBe(false)

      const deep = reactive([{ val: 1 }, { val: 5 }])
      result = computed(() => deep.some(x => x.val > 4))
      expect(result.value).toBe(true)

      deep[1].val = 2
      expect(result.value).toBe(false)
    })

    // Node 20+
    // @ts-expect-error tests are not limited to es2016
    test.skipIf(!Array.prototype.toReversed)('toReversed', () => {
      const array = reactive([1, { val: 2 }])
      const result = computed(() => (array as any).toReversed())
      expect(result.value).toStrictEqual([{ val: 2 }, 1])
      expect(isReactive(result.value[0])).toBe(true)

      array.splice(1, 1, 2)
      expect(result.value).toStrictEqual([2, 1])
    })

    // Node 20+
    // @ts-expect-error tests are not limited to es2016
    test.skipIf(!Array.prototype.toSorted)('toSorted', () => {
      // No comparer
      // @ts-expect-error
      expect(shallowReactive([2, 1, 3]).toSorted()).toStrictEqual([1, 2, 3])

      const shallow = shallowReactive([{ val: 2 }, { val: 1 }, { val: 3 }])
      let result: ComputedRef<{ val: number }[]>
      // @ts-expect-error
      result = computed(() => shallow.toSorted((a, b) => a.val - b.val))
      expect(result.value.map(x => x.val)).toStrictEqual([1, 2, 3])
      expect(isReactive(result.value[0])).toBe(false)

      shallow[0].val = 4
      expect(result.value.map(x => x.val)).toStrictEqual([1, 4, 3])

      shallow.pop()
      expect(result.value.map(x => x.val)).toStrictEqual([1, 4])

      const deep = reactive([{ val: 2 }, { val: 1 }, { val: 3 }])
      // @ts-expect-error
      result = computed(() => deep.toSorted((a, b) => a.val - b.val))
      expect(result.value.map(x => x.val)).toStrictEqual([1, 2, 3])
      expect(isReactive(result.value[0])).toBe(true)

      deep[0].val = 4
      expect(result.value.map(x => x.val)).toStrictEqual([1, 3, 4])
    })

    // Node 20+
    // @ts-expect-error tests are not limited to es2016
    test.skipIf(!Array.prototype.toSpliced)('toSpliced', () => {
      const array = reactive([1, 2, 3])
      // @ts-expect-error
      const result = computed(() => array.toSpliced(1, 1, -2))
      expect(result.value).toStrictEqual([1, -2, 3])

      array[0] = 0
      expect(result.value).toStrictEqual([0, -2, 3])
    })

    test('values', () => {
      const shallow = shallowReactive([{ val: 1 }, { val: 2 }])
      const result = computed(() => Array.from(shallow.values()))
      expect(result.value).toStrictEqual([{ val: 1 }, { val: 2 }])
      expect(isReactive(result.value[0])).toBe(false)

      shallow.pop()
      expect(result.value).toStrictEqual([{ val: 1 }])

      const deep = reactive([{ val: 1 }, { val: 2 }])
      const firstItem = Array.from(deep.values())[0]
      expect(isReactive(firstItem)).toBe(true)
    })

    test('extend methods', () => {
      class Collection extends Array {
        // @ts-expect-error
        every(foo: any, bar: any, baz: any) {
          expect(foo).toBe('foo')
          expect(bar).toBe('bar')
          expect(baz).toBe('baz')
          return super.every(obj => obj.id === foo)
        }

        // @ts-expect-error
        filter(foo: any, bar: any, baz: any) {
          expect(foo).toBe('foo')
          expect(bar).toBe('bar')
          expect(baz).toBe('baz')
          return super.filter(obj => obj.id === foo)
        }

        // @ts-expect-error
        find(foo: any, bar: any, baz: any) {
          expect(foo).toBe('foo')
          expect(bar).toBe('bar')
          expect(baz).toBe('baz')
          return super.find(obj => obj.id === foo)
        }

        // @ts-expect-error
        findIndex(foo: any, bar: any, baz: any) {
          expect(foo).toBe('foo')
          expect(bar).toBe('bar')
          expect(baz).toBe('baz')
          return super.findIndex(obj => obj.id === bar)
        }

        findLast(foo: any, bar: any, baz: any) {
          expect(foo).toBe('foo')
          expect(bar).toBe('bar')
          expect(baz).toBe('baz')
          // @ts-expect-error our code is limited to es2016 but user code is not
          return super.findLast(obj => obj.id === bar)
        }

        findLastIndex(foo: any, bar: any, baz: any) {
          expect(foo).toBe('foo')
          expect(bar).toBe('bar')
          expect(baz).toBe('baz')
          return super.findIndex(obj => obj.id === bar)
        }

        // @ts-expect-error
        forEach(foo: any, bar: any, baz: any) {
          expect(foo).toBe('foo')
          expect(bar).toBe('bar')
          expect(baz).toBe('baz')
        }

        // @ts-expect-error
        map(foo: any, bar: any, baz: any) {
          expect(foo).toBe('foo')
          expect(bar).toBe('bar')
          expect(baz).toBe('baz')
          return super.map(obj => obj.value)
        }

        // @ts-expect-error
        some(foo: any, bar: any, baz: any) {
          expect(foo).toBe('foo')
          expect(bar).toBe('bar')
          expect(baz).toBe('baz')
          return super.some(obj => obj.id === baz)
        }
      }

      const state = reactive({
        things: new Collection(),
      })

      const foo = { id: 'foo', value: '1' }
      const bar = { id: 'bar', value: '2' }
      const baz = { id: 'baz', value: '3' }
      state.things.push(foo)
      state.things.push(bar)
      state.things.push(baz)

      expect(state.things.every('foo', 'bar', 'baz')).toBe(false)
      expect(state.things.filter('foo', 'bar', 'baz')).toEqual([foo])

      const _foo = state.things.find('foo', 'bar', 'baz')
      expect(isReactive(_foo)).toBe(true)
      expect(foo).toStrictEqual(_foo)

      expect(state.things.findIndex('foo', 'bar', 'baz')).toBe(1)

      const _bar = state.things.findLast('foo', 'bar', 'baz')
      expect(isReactive(_bar)).toBe(true)
      expect(bar).toStrictEqual(_bar)

      expect(state.things.findLastIndex('foo', 'bar', 'baz')).toBe(1)
      expect(state.things.forEach('foo', 'bar', 'baz')).toBeUndefined()
      expect(state.things.map('foo', 'bar', 'baz')).toEqual(['1', '2', '3'])
      expect(state.things.some('foo', 'bar', 'baz')).toBe(true)

      {
        class Collection extends Array {
          find(matcher: any) {
            return super.find(matcher)
          }
        }

        const state = reactive({
          // @ts-expect-error
          things: new Collection({ foo: '' }),
        })

        const bar = computed(() => {
          return state.things.find((obj: any) => obj.foo === 'bar')
        })
        bar.value
        state.things[0].foo = 'bar'

        expect(bar.value).toEqual({ foo: 'bar' })
      }
    })
  })
})
