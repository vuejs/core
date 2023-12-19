import {
  Ref,
  ref,
  shallowRef,
  isRef,
  unref,
  reactive,
  proxyRefs,
  toRef,
  toValue,
  toRefs,
  ToRefs,
  shallowReactive,
  readonly,
  MaybeRef,
  MaybeRefOrGetter,
  ComputedRef,
  computed,
  ShallowRef
} from 'vue'
import { expectType, describe, IsUnion, IsAny } from './utils'

function plainType(arg: number | Ref<number>) {
  // ref coercing
  const coerced = ref(arg)
  expectType<Ref<number>>(coerced)

  // isRef as type guard
  if (isRef(arg)) {
    expectType<Ref<number>>(arg)
  }

  // ref unwrapping
  expectType<number>(unref(arg))
  expectType<number>(toValue(arg))
  expectType<number>(toValue(() => 123))

  // ref inner type should be unwrapped
  const nestedRef = ref({
    foo: ref(1)
  })
  expectType<{ foo: number }>(nestedRef.value)

  // ref boolean
  const falseRef = ref(false)
  expectType<Ref<boolean>>(falseRef)
  expectType<boolean>(falseRef.value)

  // ref true
  const trueRef = ref<true>(true)
  expectType<Ref<true>>(trueRef)
  expectType<true>(trueRef.value)

  // tuple
  expectType<[number, string]>(unref(ref([1, '1'])))

  interface IteratorFoo {
    [Symbol.iterator]: any
  }

  // with symbol
  expectType<Ref<IteratorFoo | null | undefined>>(
    ref<IteratorFoo | null | undefined>()
  )

  // should not unwrap ref inside arrays
  const arr = ref([1, new Map<string, any>(), ref('1')]).value
  const value = arr[0]
  if (isRef(value)) {
    expectType<Ref>(value)
  } else if (typeof value === 'number') {
    expectType<number>(value)
  } else {
    // should narrow down to Map type
    // and not contain any Ref type
    expectType<Map<string, any>>(value)
  }

  // should still unwrap in objects nested in arrays
  const arr2 = ref([{ a: ref(1) }]).value
  expectType<number>(arr2[0].a)

  // any value should return Ref<any>, not any
  const a = ref(1 as any)
  expectType<IsAny<typeof a>>(false)
}

plainType(1)

function bailType(arg: HTMLElement | Ref<HTMLElement>) {
  // ref coercing
  const coerced = ref(arg)
  expectType<Ref<HTMLElement>>(coerced)

  // isRef as type guard
  if (isRef(arg)) {
    expectType<Ref<HTMLElement>>(arg)
  }

  // ref unwrapping
  expectType<HTMLElement>(unref(arg))

  // ref inner type should be unwrapped
  const nestedRef = ref({ foo: ref(document.createElement('DIV')) })

  expectType<Ref<{ foo: HTMLElement }>>(nestedRef)
  expectType<{ foo: HTMLElement }>(nestedRef.value)
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
    [customSymbol]: { arr: [ref(1)] }
  }

  const objRef = ref(obj)

  expectType<Ref<number>>(objRef.value[Symbol.asyncIterator])
  expectType<{ a: Ref<string> }>(objRef.value[Symbol.hasInstance])
  expectType<{ b: Ref<boolean> }>(objRef.value[Symbol.isConcatSpreadable])
  expectType<Ref<number>[]>(objRef.value[Symbol.iterator])
  expectType<Set<Ref<number>>>(objRef.value[Symbol.match])
  expectType<Map<number, Ref<string>>>(objRef.value[Symbol.matchAll])
  expectType<{ arr: Ref<string>[] }>(objRef.value[Symbol.replace])
  expectType<{ set: Set<Ref<number>> }>(objRef.value[Symbol.search])
  expectType<{ map: Map<number, Ref<string>> }>(objRef.value[Symbol.species])
  expectType<WeakSet<Ref<boolean>>>(objRef.value[Symbol.split])
  expectType<WeakMap<Ref<boolean>, string>>(objRef.value[Symbol.toPrimitive])
  expectType<{ weakSet: WeakSet<Ref<boolean>> }>(
    objRef.value[Symbol.toStringTag]
  )
  expectType<{ weakMap: WeakMap<Ref<boolean>, string> }>(
    objRef.value[Symbol.unscopables]
  )
  expectType<{ arr: Ref<number>[] }>(objRef.value[customSymbol])
}

withSymbol()

const state = reactive({
  foo: {
    value: 1,
    label: 'bar'
  }
})

expectType<string>(state.foo.label)

describe('ref with generic', <T extends { name: string }>() => {
  const r = {} as T
  const s = ref(r)
  expectType<string>(s.value.name)

  const rr = {} as MaybeRef<T>
  // should at least allow casting
  const ss = ref(rr) as Ref<T>
  expectType<string>(ss.value.name)
})

// shallowRef
type Status = 'initial' | 'ready' | 'invalidating'
const shallowStatus = shallowRef<Status>('initial')
if (shallowStatus.value === 'initial') {
  expectType<Ref<Status>>(shallowStatus)
  expectType<Status>(shallowStatus.value)
  shallowStatus.value = 'invalidating'
}

const refStatus = ref<Status>('initial')
if (refStatus.value === 'initial') {
  expectType<Ref<Status>>(shallowStatus)
  expectType<Status>(shallowStatus.value)
  refStatus.value = 'invalidating'
}

{
  const shallow = shallowRef(1)
  expectType<Ref<number>>(shallow)
  expectType<ShallowRef<number>>(shallow)
}

{
  //#7852
  type Steps = { step: '1' } | { step: '2' }
  const shallowUnionGenParam = shallowRef<Steps>({ step: '1' })
  const shallowUnionAsCast = shallowRef({ step: '1' } as Steps)

  expectType<IsUnion<typeof shallowUnionGenParam>>(false)
  expectType<IsUnion<typeof shallowUnionAsCast>>(false)
}

{
  // any value should return Ref<any>, not any
  const a = shallowRef(1 as any)
  expectType<IsAny<typeof a>>(false)
}

describe('shallowRef with generic', <T extends { name: string }>() => {
  const r = {} as T
  const s = shallowRef(r)
  expectType<string>(s.value.name)
  expectType<ShallowRef<T>>(shallowRef(r))

  const rr = {} as MaybeRef<T>
  // should at least allow casting
  const ss = shallowRef(rr) as Ref<T> | ShallowRef<T>
  expectType<string>(ss.value.name)
})

{
  // should return ShallowRef<T> | Ref<T>, not ShallowRef<T | Ref<T>>
  expectType<ShallowRef<{ name: string }> | Ref<{ name: string }>>(
    shallowRef({} as MaybeRef<{ name: string }>)
  )
  expectType<ShallowRef<number> | Ref<string[]> | ShallowRef<string>>(
    shallowRef('' as Ref<string[]> | string | number)
  )
}

// proxyRefs: should return `reactive` directly
const r1 = reactive({
  k: 'v'
})
const p1 = proxyRefs(r1)
expectType<typeof r1>(p1)

// proxyRefs: `ShallowUnwrapRef`
const r2 = {
  a: ref(1),
  obj: {
    k: ref('foo')
  }
}
const p2 = proxyRefs(r2)
expectType<number>(p2.a)
expectType<Ref<string>>(p2.obj.k)

// toRef and toRefs
{
  const obj: {
    a: number
    b: Ref<number>
    c: number | string
  } = {
    a: 1,
    b: ref(1),
    c: 1
  }

  // toRef
  expectType<Ref<number>>(toRef(obj, 'a'))
  expectType<Ref<number>>(toRef(obj, 'b'))
  // Should not distribute Refs over union
  expectType<Ref<number | string>>(toRef(obj, 'c'))

  expectType<Ref<number>>(toRef(() => 123))
  expectType<Ref<number | string>>(toRef(() => obj.c))

  const r = toRef(() => 123)
  // @ts-expect-error
  r.value = 234

  // toRefs
  expectType<{
    a: Ref<number>
    b: Ref<number>
    // Should not distribute Refs over union
    c: Ref<number | string>
  }>(toRefs(obj))

  // Both should not do any unwrapping
  const someReactive = shallowReactive({
    a: {
      b: ref(42)
    }
  })

  const toRefResult = toRef(someReactive, 'a')
  const toRefsResult = toRefs(someReactive)

  expectType<Ref<number>>(toRefResult.value.b)
  expectType<Ref<number>>(toRefsResult.a.value.b)

  // #5188
  const props = { foo: 1 } as { foo: any }
  const { foo } = toRefs(props)
  expectType<Ref<any>>(foo)
}

// toRef default value
{
  const obj: { x?: number } = {}
  const x = toRef(obj, 'x', 1)
  expectType<Ref<number>>(x)
}

// readonly() + ref()
expectType<Readonly<Ref<number>>>(readonly(ref(1)))

// #2687
interface AppData {
  state: 'state1' | 'state2' | 'state3'
}

const data: ToRefs<AppData> = toRefs(
  reactive({
    state: 'state1'
  })
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
  expectType<T>(unref(p))
}

testUnrefGenerics(1)

// #4771
describe('shallow reactive in reactive', () => {
  const baz = reactive({
    foo: shallowReactive({
      a: {
        b: ref(42)
      }
    })
  })

  const foo = toRef(baz, 'foo')

  expectType<Ref<number>>(foo.value.a.b)
  expectType<number>(foo.value.a.b.value)
})

describe('shallow ref in reactive', () => {
  const x = reactive({
    foo: shallowRef({
      bar: {
        baz: ref(123),
        qux: reactive({
          z: ref(123)
        })
      }
    })
  })

  expectType<Ref<number>>(x.foo.bar.baz)
  expectType<number>(x.foo.bar.qux.z)
})

describe('ref in shallow ref', () => {
  const x = shallowRef({
    a: ref(123)
  })

  expectType<Ref<number>>(x.value.a)
})

describe('reactive in shallow ref', () => {
  const x = shallowRef({
    a: reactive({
      b: ref(0)
    })
  })

  expectType<number>(x.value.a.b)
})

describe('toRef <-> toValue', () => {
  function foo(
    a: MaybeRef<string>,
    b: () => string,
    c: MaybeRefOrGetter<string>,
    d: ComputedRef<string>
  ) {
    const r = toRef(a)
    expectType<Ref<string>>(r)
    // writable
    r.value = 'foo'

    const rb = toRef(b)
    expectType<Readonly<Ref<string>>>(rb)
    // @ts-expect-error ref created from getter should be readonly
    rb.value = 'foo'

    const rc = toRef(c)
    expectType<Readonly<Ref<string> | Ref<string>>>(rc)
    // @ts-expect-error ref created from MaybeReadonlyRef should be readonly
    rc.value = 'foo'

    const rd = toRef(d)
    expectType<ComputedRef<string>>(rd)
    // @ts-expect-error ref created from computed ref should be readonly
    rd.value = 'foo'

    expectType<string>(toValue(a))
    expectType<string>(toValue(b))
    expectType<string>(toValue(c))
    expectType<string>(toValue(d))

    return {
      r: toValue(r),
      rb: toValue(rb),
      rc: toValue(rc),
      rd: toValue(rd)
    }
  }

  expectType<{
    r: string
    rb: string
    rc: string
    rd: string
  }>(
    foo(
      'foo',
      () => 'bar',
      ref('baz'),
      computed(() => 'hi')
    )
  )
})
