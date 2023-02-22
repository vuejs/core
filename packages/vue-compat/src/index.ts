// This entry is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { compile } from 'vue'
import { createCompatVue } from './createCompatVue'
import { registerRuntimeCompiler } from '@vue/runtime-dom'

registerRuntimeCompiler(compile)

const Vue = createCompatVue()
Vue.compile = compile

export default Vue
