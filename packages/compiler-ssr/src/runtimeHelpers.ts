import { registerRuntimeHelpers } from '@vue/compiler-dom'

export const SSR_INTERPOLATE = Symbol(`ssrInterpolate`)
export const SSR_RENDER_VNODE = Symbol(`ssrRenderVNode`)
export const SSR_RENDER_COMPONENT = Symbol(`ssrRenderComponent`)
export const SSR_RENDER_SLOT = Symbol(`ssrRenderSlot`)
export const SSR_RENDER_SLOT_INNER = Symbol(`ssrRenderSlotInner`)
export const SSR_RENDER_CLASS = Symbol(`ssrRenderClass`)
export const SSR_RENDER_STYLE = Symbol(`ssrRenderStyle`)
export const SSR_RENDER_ATTRS = Symbol(`ssrRenderAttrs`)
export const SSR_RENDER_ATTR = Symbol(`ssrRenderAttr`)
export const SSR_RENDER_DYNAMIC_ATTR = Symbol(`ssrRenderDynamicAttr`)
export const SSR_RENDER_LIST = Symbol(`ssrRenderList`)
export const SSR_INCLUDE_BOOLEAN_ATTR = Symbol(`ssrIncludeBooleanAttr`)
export const SSR_LOOSE_EQUAL = Symbol(`ssrLooseEqual`)
export const SSR_LOOSE_CONTAIN = Symbol(`ssrLooseContain`)
export const SSR_RENDER_DYNAMIC_MODEL = Symbol(`ssrRenderDynamicModel`)
export const SSR_GET_DYNAMIC_MODEL_PROPS = Symbol(`ssrGetDynamicModelProps`)
export const SSR_RENDER_TELEPORT = Symbol(`ssrRenderTeleport`)
export const SSR_RENDER_SUSPENSE = Symbol(`ssrRenderSuspense`)
export const SSR_GET_DIRECTIVE_PROPS = Symbol(`ssrGetDirectiveProps`)

export const ssrHelpers = {
  [SSR_INTERPOLATE]: `ssrInterpolate`,
  [SSR_RENDER_VNODE]: `ssrRenderVNode`,
  [SSR_RENDER_COMPONENT]: `ssrRenderComponent`,
  [SSR_RENDER_SLOT]: `ssrRenderSlot`,
  [SSR_RENDER_SLOT_INNER]: `ssrRenderSlotInner`,
  [SSR_RENDER_CLASS]: `ssrRenderClass`,
  [SSR_RENDER_STYLE]: `ssrRenderStyle`,
  [SSR_RENDER_ATTRS]: `ssrRenderAttrs`,
  [SSR_RENDER_ATTR]: `ssrRenderAttr`,
  [SSR_RENDER_DYNAMIC_ATTR]: `ssrRenderDynamicAttr`,
  [SSR_RENDER_LIST]: `ssrRenderList`,
  [SSR_INCLUDE_BOOLEAN_ATTR]: `ssrIncludeBooleanAttr`,
  [SSR_LOOSE_EQUAL]: `ssrLooseEqual`,
  [SSR_LOOSE_CONTAIN]: `ssrLooseContain`,
  [SSR_RENDER_DYNAMIC_MODEL]: `ssrRenderDynamicModel`,
  [SSR_GET_DYNAMIC_MODEL_PROPS]: `ssrGetDynamicModelProps`,
  [SSR_RENDER_TELEPORT]: `ssrRenderTeleport`,
  [SSR_RENDER_SUSPENSE]: `ssrRenderSuspense`,
  [SSR_GET_DIRECTIVE_PROPS]: `ssrGetDirectiveProps`
}

// Note: these are helpers imported from @vue/server-renderer
// make sure the names match!
registerRuntimeHelpers(ssrHelpers)
