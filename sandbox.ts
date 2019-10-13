import { reactive, toRefs } from './packages/reactivity/src'
import { watch } from './packages/runtime-core/src'

const state = reactive({
  name: ''
})

const stateRefs = toRefs(state)

const stop = watch(
  stateRefs,
  value => {
    value.name
  },
  { deep: true }
)
