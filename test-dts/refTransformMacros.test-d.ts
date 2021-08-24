import { WritableComputedRef } from '@vue/reactivity'
import { expectType, ref, Ref, ComputedRef } from './index'
import 'vue/ref-macros'

// wrapping refs
// normal
// computed
// writable computed

// destructure
const { x, y, z } = $(useFoo())
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

function useFoo() {
  return {
    x: ref(1),
    y: ref('hi'),
    z: 123
  }
}

// $$
expectType<Ref<number>>($$(x))
expectType<Ref<string>>($$(y))

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
