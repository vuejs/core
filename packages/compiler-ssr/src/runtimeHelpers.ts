import { registerRuntimeHelpers } from '@vue/compiler-dom'

export const SSR_INTERPOLATE = Symbol(`interpolate`)
export const SSR_RENDER_COMPONENT = Symbol(`renderComponent`)
export const SSR_RENDER_SLOT = Symbol(`renderSlot`)
export const SSR_RENDER_CLASS = Symbol(`renderClass`)
export const SSR_RENDER_STYLE = Symbol(`renderStyle`)
export const SSR_RENDER_PROPS = Symbol(`renderProps`)
export const SSR_RENDER_LIST = Symbol(`renderList`)

// Note: these are helpers imported from @vue/server-renderer
// make sure the names match!
registerRuntimeHelpers({
  [SSR_INTERPOLATE]: `_interpolate`,
  [SSR_RENDER_COMPONENT]: `_renderComponent`,
  [SSR_RENDER_SLOT]: `_renderSlot`,
  [SSR_RENDER_CLASS]: `_renderClass`,
  [SSR_RENDER_STYLE]: `_renderStyle`,
  [SSR_RENDER_PROPS]: `_renderProps`,
  [SSR_RENDER_LIST]: `_renderList`
})
