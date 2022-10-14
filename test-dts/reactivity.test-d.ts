import {
  ref,
  readonly,
  shallowReadonly,
  describe,
  expectError,
  expectType,
  Ref,
  reactive,
  markRaw
} from './index'

describe('should support DeepReadonly', () => {
  const r = readonly({ obj: { k: 'v' } })
  // @ts-expect-error
  expectError((r.obj = {}))
  // @ts-expect-error
  expectError((r.obj.k = 'x'))
})

// #4180
describe('readonly ref', () => {
  const r = readonly(ref({ count: 1 }))
  expectType<Ref>(r)
})

describe('should support markRaw', () => {
  class Test<T> {
    item = {} as Ref<T>
  }
  const test = new Test<number>()
  const plain = {
    ref: ref(1)
  }

  const r = reactive({
    class: {
      raw: markRaw(test),
      reactive: test
    },
    plain: {
      raw: markRaw(plain),
      reactive: plain
    }
  })

  expectType<Test<number>>(r.class.raw)
  // @ts-expect-error it should unwrap
  expectType<Test<number>>(r.class.reactive)

  expectType<Ref<number>>(r.plain.raw.ref)
  // @ts-expect-error it should unwrap
  expectType<Ref<number>>(r.plain.reactive.ref)
})

describe('shallowReadonly ref unwrap', () => {
  const r = shallowReadonly({ count: { n: ref(1) } })
  // @ts-expect-error
  r.count = 2
  expectType<Ref>(r.count.n)
  r.count.n.value = 123
})

describe('collection-type', () => {
  it('primitive type as value', () => {
    const m = reactive(new Map<string, number>())
    const s = reactive(new Set<string>())
    m.set('a', 1)
    s.add('b')

    expectType<Map<string, number>>(m)
    expectType<Set<string>>(s)
    expectType<number>(m.get('a')!)
    m.forEach((v1, v2, m) => {
      expectType<number>(v1)
      expectType<string>(v2)
      expectType<Map<string, number>>(m)
    })
    s.forEach((v1, v2, s) => {
      expectType<string>(v1)
      expectType<string>(v2)
      expectType<Set<string>>(s)
    })
  })

  it('composite types as values', () => {
    const m = reactive(new Map<string, {a: number}>())
    const s = reactive(new Set<{a: number}>())
    m.set('a', {a: 1})
    s.add({a: 1})

    expectType<{a: number}>(m.get('a')!)
    m.forEach((v1, v2, m) => {
      expectType<{a: number}>(v1)
      expectType<string>(v2)
    })
    s.forEach((v1, v2, s) => {
      expectType<{a: number}>(v1)
      expectType<{a: number}>(v2)
    })
  })

  it('composite type as key', () => {
    const m = reactive(new Map<{a: number}, string>())
    m.set({a: 1}, 'a')
    m.forEach((v1, v2, m) => {
      expectType<string>(v1)
      expectType<{a: number}>(v2)
    })
  })

  it('ref as value', () => {
    const m = reactive(new Map<string, Ref<number>>())
    const s = reactive(new Set<Ref<string>>())
    m.set('a', ref(1))
    s.add(ref('b'))

    expectType<Map<string, Ref<number>>>(m)
    expectType<Set<Ref<string>>>(s)
    expectType<Ref<number>>(m.get('a')!)

    m.forEach((v1, v2, m) => {
      expectType<Ref<number>>(v1)
      expectType<string>(v2)
      expectType<Map<string, Ref<number>>>(m)
    })

    s.forEach((v1, v2, s) => {
      expectType<Ref<string>>(v1)
      expectType<Ref<string>>(v2)
      expectType<Set<Ref<string>>>(s)
    })
  })

  it('when value is an object and ref is used as an object property', () => {
    const m = reactive(new Map<string, { foo: Ref<number> }>())
    const s = reactive(new Set<{ foo:Ref<number> }>())
    m.set('a', {
      foo: ref(1)
    })
    s.add({
      foo: ref(1)
    })


    expectType<Map<string, { foo: Ref<number> }>>(m)
    expectType<Set<{ foo:Ref<number> }>>(s)
    expectType<{foo: number}>(m.get('a')!)

    m.forEach((v1, v2, m) => {
      expectType<{ foo: number }>(v1)
      expectType<string>(v2)
      expectType<Map<string, { foo: Ref<number> }>>(m)
    })

    s.forEach((v1, v2, s) => {
      expectType<{foo: number}>(v1)
      expectType<{foo: number}>(v2)
      expectType<Set<{foo: Ref<number>}>>(s)
    })
  })
  it('When the key is an object and the responsive data is an object property', () => {
    const m = reactive(new Map<{ foo: Ref<number> }, string>())
    const obj = {
      foo: ref(1)
    }
    m.set(obj, 'a')

    expectType<Map<{ foo:Ref<number> }, string>>(m)
    m.forEach((v1, v2, m) => {
      expectType<string>(v1)
      expectType<{foo: number}>(v2)
      expectType<Map<{ foo: Ref<number> }, string>>(m)
    })
  })
  it('normal use under non-reactive', () => {
    const m = new Map<string, number>()
    const s = new Set<string>()
    const mr = new Map<{a: Ref<number>}, {b: Ref<number>}>()
    const sr = new Set<{a: Ref<number>}>()
    const objA = {
      a: ref(1)
    }
    const objB = {
      b: ref(1)
    }

    m.set('a', 1)
    s.add('b')
    mr.set(objA, objB)
    sr.add(objA)

    expectType<Map<string, number>>(m)
    expectType<Set<string>>(s)
    expectType<Map<{a: Ref<number>}, {b: Ref<number>}>>(mr)
    expectType<Set<{a: Ref<number>}>>(sr)
    expectType<number>(m.get('a')!)
    expectType<{b: Ref<number>}>(mr.get(objA)!)

    m.forEach((v1, v2, m) => {
      expectType<number>(v1)
      expectType<string>(v2)
      expectType<Map<string, number>>(m)
    })
    s.forEach((v1, v2, s) => {
      expectType<string>(v1)
      expectType<string>(v2)
      expectType<Set<string>>(s)
    })
    mr.forEach((v1, v2, m) => {
      expectType<{b: Ref<number>}>(v1)
      expectType<{a: Ref<number>}>(v2)
      expectType<Map<{a: Ref<number>}, {b: Ref<number>}>>(m)
    })
    sr.forEach((v1, v2, s) => {
      expectType<{a: Ref<number>}>(v1)
      expectType<{a: Ref<number>}>(v2)
      expectType<Set<{a: Ref<number>}>>(s)
    })
  })
})
