import { ref, computed, Ref, ComputedRef, WritableComputedRef } from 'vue'
import 'vue/macros-global'
import { RefType, RefTypes } from 'vue/macros'
import { expectType } from './utils'

// wrapping refs

// normal
let n = $(ref(1))
n = 2
// @ts-expect-error
n = 'foo'

// #4499 nullable
let msg = $(ref<string | null>(null))
msg = 'hello world'
msg = null
expectType<RefTypes.Ref | undefined>(msg![RefType])

// computed
let m = $(computed(() => n + 1))
m * 1
// @ts-expect-error
m.slice()
expectType<RefTypes.ComputedRef | undefined>(m[RefType])

// writable computed
let wc = $(
  computed({
    get: () => n + 1,
    set: v => (n = v - 1)
  })
)
wc = 2
// @ts-expect-error
wc = 'foo'
expectType<RefTypes.WritableComputedRef | undefined>(wc[RefType])

// destructure
function useFoo() {
  let x = $ref(1)
  let y = $computed(() => 'hi')

  return $$({
    x,
    y,
    z: 123
  })
}

const fooRes = useFoo()
const { x, y, z } = $(fooRes)
expectType<number>(x)
expectType<string>(y)
expectType<number>(z)

// $ref
expectType<number>($ref(1))
expectType<number>($ref(ref(1)))
expectType<{ foo: number }>($ref({ foo: ref(1) }))

// $shallowRef
expectType<number>($shallowRef(1))
expectType<{ foo: Ref<number> }>($shallowRef({ foo: ref(1) }))

// $computed
expectType<number>($computed(() => 1))
let b = $ref(1)
expectType<number>(
  $computed(() => b, {
    onTrack() {}
  })
)

// writable computed
expectType<number>(
  $computed({
    get: () => 1,
    set: () => {}
  })
)

// $$
const xRef = $$(x)
expectType<Ref<number>>(xRef)

const yRef = $$(y)
expectType<ComputedRef<string>>(yRef)

const c = $computed(() => 1)
const cRef = $$(c)
expectType<ComputedRef<number>>(cRef)

const c2 = $computed({
  get: () => 1,
  set: () => {}
})
const c2Ref = $$(c2)
expectType<WritableComputedRef<number>>(c2Ref)

// $$ on object
const obj = $$({
  n,
  m,
  wc
})

expectType<Ref<number>>(obj.n)
expectType<ComputedRef<number>>(obj.m)
expectType<WritableComputedRef<number>>(obj.wc)
