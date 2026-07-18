import {
  type ComputedRef,
  type MaybeRef,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
  type TemplateRef,
  type ToRefs,
  type WritableComputedRef,
  computed,
  customRef,
  isRef,
  proxyRefs,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowRef,
  toRef,
  toRefs,
  toValue,
  unref,
  useTemplateRef,
} from 'vue'
import {
  type IsAny,
  type IsUnion,
  describe,
  expectAssignable,
  expectType,
} from './utils'

function plainType(arg: number | Ref<number>) {
  // ref coercing
  const coerced = ref(arg)
  expectType(coerced, {} as Ref<number>)

  // isRef as type guard
  if (isRef(arg)) {
    expectType(arg, {} as Ref<number>)
  }

  // ref unwrapping
  expectType(unref(arg), {} as number)
  expectType(toValue(arg), {} as number)
  expectType(
    toValue(() => 123),
    {} as number,
  )

  // ref inner type should be unwrapped
  const nestedRef = ref({
    foo: ref(1),
  })
  expectType(nestedRef.value, {} as { foo: number })

  // ref boolean
  const falseRef = ref(false)
  expectType(falseRef, {} as Ref<boolean>)
  expectType(falseRef.value, {} as boolean)

  // ref true
  const trueRef = ref<true>(true)
  expectType(trueRef, {} as Ref<true>)
  expectType(trueRef.value, {} as true)

  // tuple
  expectAssignable<[number, string]>(unref(ref([1, '1'])))

  interface IteratorFoo {
    [Symbol.iterator]: any
  }

  // with symbol
  expectType(
    ref<IteratorFoo | null | undefined>(),
    {} as Ref<IteratorFoo | null | undefined>,
  )

  // should not unwrap ref inside arrays
  const arr = ref([1, new Map<string, any>(), ref('1')]).value
  const value = arr[0]
  if (isRef(value)) {
    expectAssignable<Ref>(value)
  } else if (typeof value === 'number') {
    expectType(value, {} as number)
  } else {
    // should narrow down to Map type
    // and not contain any Ref type
    expectAssignable<Map<string, any>>(value)
  }

  // should still unwrap in objects nested in arrays
  const arr2 = ref([{ a: ref(1) }]).value
  expectType(arr2[0].a, {} as number)

  // any value should return Ref<any>, not any
  const a = ref(1 as any)
  expectType(false, {} as IsAny<typeof a>)
}

plainType(1)

function bailType(arg: HTMLElement | Ref<HTMLElement>) {
  // ref coercing
  const coerced = ref(arg)
  expectType(coerced, {} as Ref<HTMLElement>)

  // isRef as type guard
  if (isRef(arg)) {
    expectType(arg, {} as Ref<HTMLElement>)
  }

  // ref unwrapping
  expectType(unref(arg), {} as HTMLElement)

  // ref inner type should be unwrapped
  const nestedRef = ref({ foo: ref(document.createElement('DIV')) })

  expectType(nestedRef, {} as Ref<{ foo: HTMLElement }>)
  expectType(nestedRef.value, {} as { foo: HTMLElement })
}
const el = document.createElement('DIV')
bailType(el)

function withSymbol() {
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

  expectType(objRef.value[Symbol.asyncIterator], {} as Ref<number>)
  expectType(objRef.value[Symbol.hasInstance], {} as { a: Ref<string> })
  expectType(objRef.value[Symbol.isConcatSpreadable], {} as { b: Ref<boolean> })
  expectType(objRef.value[Symbol.iterator], {} as Ref<number>[])
  expectType(objRef.value[Symbol.match], {} as Set<Ref<number>>)
  expectType(objRef.value[Symbol.matchAll], {} as Map<number, Ref<string>>)
  expectType(objRef.value[Symbol.replace], {} as { arr: Ref<string>[] })
  expectType(objRef.value[Symbol.search], {} as { set: Set<Ref<number>> })
  expectType(
    objRef.value[Symbol.species],
    {} as { map: Map<number, Ref<string>> },
  )
  expectType(objRef.value[Symbol.split], {} as WeakSet<Ref<boolean>>)
  expectType(
    objRef.value[Symbol.toPrimitive],
    {} as WeakMap<Ref<boolean>, string>,
  )
  expectType(
    objRef.value[Symbol.toStringTag],
    {} as { weakSet: WeakSet<Ref<boolean>> },
  )
  expectType(
    objRef.value[Symbol.unscopables],
    {} as { weakMap: WeakMap<Ref<boolean>, string> },
  )
  expectType(objRef.value[customSymbol], {} as { arr: Ref<number>[] })
}

withSymbol()

const state = reactive({
  foo: {
    value: 1,
    label: 'bar',
  },
})

expectType(state.foo.label, {} as string)

describe('ref with generic', <T extends { name: string }>() => {
  const r = {} as T
  const s = ref(r)
  expectAssignable<string>(s.value.name)

  const rr = {} as MaybeRef<T>
  // should at least allow casting
  const ss = ref(rr) as Ref<T>
  expectType(ss.value.name, {} as string)
})

describe('allow getter and setter types to be unrelated', <T>() => {
  const a = { b: ref(0) }
  const c = ref(a)
  c.value = a

  const d = {} as T
  const e = ref(d)
  e.value = d

  const f = ref(ref(0))
  expectType(f.value, {} as number)
  // @ts-expect-error
  f.value = ref(1)
})

describe('correctly unwraps nested refs', () => {
  const obj = {
    n: 24,
    ref: ref(24),
    nestedRef: ref({ n: ref(0) }),
  }

  const a = ref(obj)
  expectType(a.value.n, {} as number)
  expectType(a.value.ref, {} as number)
  expectType(a.value.nestedRef.n, {} as number)

  const b = reactive({ a })
  expectType(b.a.n, {} as number)
  expectType(b.a.ref, {} as number)
  expectType(b.a.nestedRef.n, {} as number)
})

// computed
describe('allow computed getter and setter types to be unrelated', () => {
  const obj = ref({
    name: 'foo',
  })

  const c = computed({
    get() {
      return JSON.stringify(obj.value)
    },
    set(val: typeof obj.value) {
      obj.value = val
    },
  })

  c.value = { name: 'bar' } // object

  expectType(c.value, {} as string)
})

describe('Type safety for `WritableComputedRef` and `ComputedRef`', () => {
  // @ts-expect-error
  const writableComputed: WritableComputedRef<string> = computed(() => '')
  // should allow
  const immutableComputed: ComputedRef<string> = writableComputed
  expectType(immutableComputed, {} as ComputedRef<string>)
})

// shallowRef
type Status = 'initial' | 'ready' | 'invalidating'
const shallowStatus = shallowRef<Status>('initial')
if (shallowStatus.value === 'initial') {
  expectAssignable<Ref<Status>>(shallowStatus)
  expectAssignable<Status>(shallowStatus.value)
  shallowStatus.value = 'invalidating'
}

const refStatus = ref<Status>('initial')
if (refStatus.value === 'initial') {
  expectAssignable<Ref<Status>>(shallowStatus)
  expectAssignable<Status>(shallowStatus.value)
  refStatus.value = 'invalidating'
}

{
  const shallow = shallowRef(1)
  expectAssignable<Ref<number>>(shallow)
  expectType(shallow, {} as ShallowRef<number>)
}

{
  //#7852
  type Steps = { step: '1' } | { step: '2' }
  const shallowUnionGenParam = shallowRef<Steps>({ step: '1' })
  const shallowUnionAsCast = shallowRef({ step: '1' } as Steps)

  expectType(false, {} as IsUnion<typeof shallowUnionGenParam>)
  expectType(false, {} as IsUnion<typeof shallowUnionAsCast>)
}

{
  // any value should return Ref<any>, not any
  const a = shallowRef(1 as any)
  expectType(false, {} as IsAny<typeof a>)
}

describe('shallowRef with generic', <T extends { name: string }>() => {
  const r = {} as T
  const s = shallowRef(r)
  expectAssignable<string>(s.value.name)
  expectAssignable<ShallowRef<T>>(shallowRef(r))

  const rr = {} as MaybeRef<T>
  // should at least allow casting
  const ss = shallowRef(rr) as Ref<T> | ShallowRef<T>
  expectType(ss.value.name, {} as string)
})

{
  // should return ShallowRef<T> | Ref<T>, not ShallowRef<T | Ref<T>>
  expectAssignable<ShallowRef<{ name: string }> | Ref<{ name: string }>>(
    shallowRef({} as MaybeRef<{ name: string }>),
  )
  expectType(
    shallowRef('' as Ref<string[]> | string | number),
    {} as ShallowRef<number> | Ref<string[]> | ShallowRef<string>,
  )
}

// proxyRefs: should return `reactive` directly
const r1 = reactive({
  k: 'v',
})
const p1 = proxyRefs(r1)
expectType(p1, {} as typeof r1)

// proxyRefs: `ShallowUnwrapRef`
const r2 = {
  a: ref(1),
  c: computed(() => 1),
  u: undefined,
  obj: {
    k: ref('foo'),
  },
  union: Math.random() > 0 - 5 ? ref({ name: 'yo' }) : null,
}
const p2 = proxyRefs(r2)
expectType(p2.a, {} as number)
expectType(p2.c, {} as number)
expectType(p2.u, {} as unknown as undefined)
expectType(p2.obj.k, {} as Ref<string>)
expectType(p2.union, {} as { name: string } | null)

const r3 = shallowReactive({
  n: ref(1),
})
const p3 = proxyRefs(r3)
expectType(p3.n, {} as Ref<number>)

// toRef and toRefs
{
  const obj: {
    a: number
    b: Ref<number>
    c: number | string
  } = {
    a: 1,
    b: ref(1),
    c: 1,
  }

  // toRef
  expectType(toRef(obj, 'a'), {} as Ref<number>)
  expectType(toRef(obj, 'b'), {} as Ref<number>)
  // Should not distribute Refs over union
  expectType(toRef(obj, 'c'), {} as Ref<number | string>)

  const array = reactive(['a', 'b'])
  expectType(toRef(array, '1'), {} as Ref<string>)
  expectType(toRef(array, '1', 'fallback'), {} as Ref<string>)

  const tuple: [string, number] = ['a', 1]
  expectType(toRef(tuple, '0'), {} as Ref<string>)
  expectType(toRef(tuple, '1'), {} as Ref<number>)

  expectAssignable<Ref<number>>(toRef(() => 123))
  expectAssignable<Ref<number | string>>(toRef(() => obj.c))

  const r = toRef(() => 123)
  // @ts-expect-error
  r.value = 234

  // toRefs
  expectType(
    toRefs(obj),
    {} as {
      a: Ref<number>
      b: Ref<number>
      // Should not distribute Refs over union
      c: Ref<number | string>
    },
  )

  // Both should not do any unwrapping
  const someReactive = shallowReactive({
    a: {
      b: ref(42),
    },
  })

  const toRefResult = toRef(someReactive, 'a')
  const toRefsResult = toRefs(someReactive)

  expectType(toRefResult.value.b, {} as Ref<number>)
  expectType(toRefsResult.a.value.b, {} as Ref<number>)

  // #5188
  const props = { foo: 1 } as { foo: any }
  const { foo } = toRefs(props)
  expectType(foo, {} as Ref<any>)
}

// toRef default value
{
  const obj: { x?: number } = {}
  const x = toRef(obj, 'x', 1)
  expectType(x, {} as Ref<number>)
}

// readonly() + ref()
expectType(readonly(ref(1)), {} as Readonly<Ref<number>>)

// #2687
interface AppData {
  state: 'state1' | 'state2' | 'state3'
}

const data: ToRefs<AppData> = toRefs(
  reactive({
    state: 'state1',
  }),
)

switch (data.state.value) {
  case 'state1':
    data.state.value = 'state2'
    break
  case 'state2':
    data.state.value = 'state3'
    break
  case 'state3':
    data.state.value = 'state1'
    break
}

// #3954
function testUnrefGenerics<T>(p: T | Ref<T>) {
  expectType(unref(p), {} as T)
}

testUnrefGenerics(1)

// #4771
describe('shallow reactive in reactive', () => {
  const baz = reactive({
    foo: shallowReactive({
      a: {
        b: ref(42),
      },
    }),
  })

  const foo = toRef(baz, 'foo')

  expectType(foo.value.a.b, {} as Ref<number>)
  expectType(foo.value.a.b.value, {} as number)
})

describe('shallow reactive collection in reactive', () => {
  const baz = reactive({
    foo: shallowReactive(new Map([['a', ref(42)]])),
  })

  const foo = toRef(baz, 'foo')
  expectType(foo.value.get('a'), {} as Ref<number> | undefined)
})

describe('shallow ref in reactive', () => {
  const x = reactive({
    foo: shallowRef({
      bar: {
        baz: ref(123),
        qux: reactive({
          z: ref(123),
        }),
      },
    }),
  })

  expectType(x.foo.bar.baz, {} as Ref<number>)
  expectType(x.foo.bar.qux.z, {} as number)
})

describe('ref in shallow ref', () => {
  const x = shallowRef({
    a: ref(123),
  })

  expectType(x.value.a, {} as Ref<number>)
})

describe('reactive in shallow ref', () => {
  const x = shallowRef({
    a: reactive({
      b: ref(0),
    }),
  })

  expectType(x.value.a.b, {} as number)
})

describe('toRef <-> toValue', () => {
  function foo(
    a: MaybeRef<string>,
    b: () => string,
    c: MaybeRefOrGetter<string>,
    d: ComputedRef<string>,
  ) {
    const r = toRef(a)
    expectAssignable<Ref<string>>(r)
    // writable
    r.value = 'foo'

    const rb = toRef(b)
    expectType(rb, {} as Readonly<Ref<string>>)
    // @ts-expect-error ref created from getter should be readonly
    rb.value = 'foo'

    const rc = toRef(c)
    expectAssignable<Readonly<Ref<string> | Ref<string>>>(rc)
    // @ts-expect-error ref created from MaybeReadonlyRef should be readonly
    rc.value = 'foo'

    const rd = toRef(d)
    expectType(rd, {} as ComputedRef<string>)
    // @ts-expect-error ref created from computed ref should be readonly
    rd.value = 'foo'

    expectType(toValue(a), {} as string)
    expectType(toValue(b), {} as string)
    expectType(toValue(c), {} as string)
    expectType(toValue(d), {} as string)

    return {
      r: toValue(r),
      rb: toValue(rb),
      rc: toValue(rc),
      rd: toValue(rd),
    }
  }

  expectType(
    foo(
      'foo',
      () => 'bar',
      ref('baz'),
      computed(() => 'hi'),
    ),
    {} as {
      r: string
      rb: string
      rc: string
      rd: string
    },
  )
})

// unref
// #8747
declare const unref1: number | Ref<number> | ComputedRef<number>
expectType(unref(unref1), {} as number)

// #11356
declare const unref2:
  | MaybeRef<string>
  | ShallowRef<string>
  | ComputedRef<string>
  | WritableComputedRef<string>
expectType(unref(unref2), {} as string)

// toValue
expectType(toValue(unref1), {} as number)
expectType(toValue(unref2), {} as string)

// useTemplateRef
const tRef = useTemplateRef('foo')
expectType(tRef, {} as TemplateRef)

const tRef2 = useTemplateRef<HTMLElement>('bar')
expectType(tRef2, {} as TemplateRef<HTMLElement>)

// #14637 customRef with different getter/setter types
describe('customRef with different getter/setter types', () => {
  // customRef should support different getter/setter types like Ref<T, S>
  const cr = customRef<string, number>((track, trigger) => ({
    get: () => 'hello',
    set: (val: number) => {
      // setter accepts number, getter returns string
      trigger()
    },
  }))

  // getter returns string
  expectType(cr.value, {} as string)
  // setter accepts number
  cr.value = 123
  // @ts-expect-error setter doesn't accept string
  cr.value = 'world'
})
