import { registerRuntimeHelpers } from '@vue/compiler-dom'

export const SSR_INTERPOLATE = Symbol(`ssrInterpolate`)
export const SSR_RENDER_COMPONENT = Symbol(`ssrRenderComponent`)
export const SSR_RENDER_SLOT = Symbol(`ssrRenderSlot`)
export const SSR_RENDER_CLASS = Symbol(`ssrRenderClass`)
export const SSR_RENDER_STYLE = Symbol(`ssrRenderStyle`)
export const SSR_RENDER_ATTRS = Symbol(`ssrRenderAttrs`)
export const SSR_RENDER_ATTR = Symbol(`ssrRenderAttr`)
export const SSR_RENDER_DYNAMIC_ATTR = Symbol(`ssrRenderDynamicAttr`)
export const SSR_RENDER_LIST = Symbol(`ssrRenderList`)
export const SSR_LOOSE_EQUAL = Symbol(`ssrLooseEqual`)
export const SSR_LOOSE_CONTAIN = Symbol(`ssrLooseContain`)
export const SSR_RENDER_DYNAMIC_MODEL = Symbol(`ssrRenderDynamicModel`)
export const SSR_GET_DYNAMIC_MODEL_PROPS = Symbol(`ssrGetDynamicModelProps`)

export const ssrHelpers = {
  [SSR_INTERPOLATE]: `_ssrInterpolate`,
  [SSR_RENDER_COMPONENT]: `_ssrRenderComponent`,
  [SSR_RENDER_SLOT]: `_ssrRenderSlot`,
  [SSR_RENDER_CLASS]: `_ssrRenderClass`,
  [SSR_RENDER_STYLE]: `_ssrRenderStyle`,
  [SSR_RENDER_ATTRS]: `_ssrRenderAttrs`,
  [SSR_RENDER_ATTR]: `_ssrRenderAttr`,
  [SSR_RENDER_DYNAMIC_ATTR]: `_ssrRenderDynamicAttr`,
  [SSR_RENDER_LIST]: `_ssrRenderList`,
  [SSR_LOOSE_EQUAL]: `_ssrLooseEqual`,
  [SSR_LOOSE_CONTAIN]: `_ssrLooseContain`,
  [SSR_RENDER_DYNAMIC_MODEL]: `_ssrRenderDynamicModel`,
  [SSR_GET_DYNAMIC_MODEL_PROPS]: `_ssrGetDynamicModelProps`
}

// Note: these are helpers imported from @vue/server-renderer
// make sure the names match!
registerRuntimeHelpers(ssrHelpers)
