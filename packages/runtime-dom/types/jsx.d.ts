// Note: this will be removed from the runtime-dom package in 3.4
// If you are using JSX and needs to augment the related interfaces,
// you should augment the `vue/jsx-runtime/dom` module instead.
// That is, instead of:
// declare module '@vue/runtime-dom' {
//  export interface HTMLAttributes {
//    ...
//  }
// }
// You should do:
// declare module 'vue/jsx-runtime/dom' {
//  export interface HTMLAttributes {
//    ...
//  }
// }
export * from '../jsx'
