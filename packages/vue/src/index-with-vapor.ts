// for type generation only
export * from './index'
export * from '@vue/runtime-vapor'
export type { VaporSlot } from '@vue/runtime-vapor'
// Override the standard runtime alias so Vapor builds keep the Vapor wrapper.
export { defineVaporAsyncComponent, withAsyncContext } from '@vue/runtime-vapor'
