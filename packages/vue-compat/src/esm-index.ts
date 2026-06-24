import Vue from './index'

export default Vue
export * from '@vue/runtime-dom'

const configureCompat: typeof Vue.configureCompat = Vue.configureCompat
export { configureCompat }
