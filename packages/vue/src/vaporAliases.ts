// Vapor-only APIs do not exist in the standard build, yet SSR executes
// the standard entry. We alias them to the core implementations so SSR
// keeps working without the Vapor runtime.
export {
  defineAsyncComponent as defineVaporAsyncComponent,
  defineComponent as defineVaporComponent,
} from '@vue/runtime-core'
