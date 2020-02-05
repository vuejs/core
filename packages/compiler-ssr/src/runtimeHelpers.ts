import { registerRuntimeHelpers } from '@vue/compiler-dom'

export const SSR_INTERPOLATE = Symbol(`interpolate`)
export const SSR_RENDER_COMPONENT = Symbol(`renderComponent`)
export const SSR_RENDER_SLOT = Symbol(`renderSlot`)
export const SSR_RENDER_CLASS = Symbol(`renderClass`)
export const SSR_RENDER_STYLE = Symbol(`renderStyle`)
export const SSR_RENDER_ATTRS = Symbol(`renderAttrs`)
export const SSR_RENDER_ATTR = Symbol(`renderAttr`)
export const SSR_RENDER_DYNAMIC_ATTR = Symbol(`renderDynamicAttr`)
export const SSR_RENDER_LIST = Symbol(`renderList`)
export const SSR_LOOSE_EQUAL = Symbol(`looseEqual`)
export const SSR_LOOSE_CONTAIN = Symbol(`looseContain`)

export const ssrHelpers = {
  [SSR_INTERPOLATE]: `_interpolate`,
  [SSR_RENDER_COMPONENT]: `_renderComponent`,
  [SSR_RENDER_SLOT]: `_renderSlot`,
  [SSR_RENDER_CLASS]: `_renderClass`,
  [SSR_RENDER_STYLE]: `_renderStyle`,
  [SSR_RENDER_ATTRS]: `_renderAttrs`,
  [SSR_RENDER_ATTR]: `_renderAttr`,
  [SSR_RENDER_DYNAMIC_ATTR]: `_renderDynamicAttr`,
  [SSR_RENDER_LIST]: `_renderList`,
  [SSR_LOOSE_EQUAL]: `_looseEqual`,
  [SSR_LOOSE_CONTAIN]: `_looseContain`
}

// Note: these are helpers imported from @vue/server-renderer
// make sure the names match!
registerRuntimeHelpers(ssrHelpers)
