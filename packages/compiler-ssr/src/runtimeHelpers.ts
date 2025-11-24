import { registerRuntimeHelpers } from '@vue/compiler-dom'

export const SSR_INTERPOLATE: unique symbol = Symbol(`ssrInterpolate`)
export const SSR_RENDER_VNODE: unique symbol = Symbol(`ssrRenderVNode`)
export const SSR_RENDER_COMPONENT: unique symbol = Symbol(`ssrRenderComponent`)
export const SSR_RENDER_SLOT: unique symbol = Symbol(`ssrRenderSlot`)
export const SSR_RENDER_SLOT_INNER: unique symbol = Symbol(`ssrRenderSlotInner`)
export const SSR_RENDER_CLASS: unique symbol = Symbol(`ssrRenderClass`)
export const SSR_RENDER_STYLE: unique symbol = Symbol(`ssrRenderStyle`)
export const SSR_RENDER_ATTRS: unique symbol = Symbol(`ssrRenderAttrs`)
export const SSR_RENDER_ATTR: unique symbol = Symbol(`ssrRenderAttr`)
export const SSR_RENDER_DYNAMIC_ATTR: unique symbol =
  Symbol(`ssrRenderDynamicAttr`)
export const SSR_RENDER_LIST: unique symbol = Symbol(`ssrRenderList`)
export const SSR_INCLUDE_BOOLEAN_ATTR: unique symbol = Symbol(
  `ssrIncludeBooleanAttr`,
)
export const SSR_LOOSE_EQUAL: unique symbol = Symbol(`ssrLooseEqual`)
export const SSR_LOOSE_CONTAIN: unique symbol = Symbol(`ssrLooseContain`)
export const SSR_RENDER_DYNAMIC_MODEL: unique symbol = Symbol(
  `ssrRenderDynamicModel`,
)
export const SSR_GET_DYNAMIC_MODEL_PROPS: unique symbol = Symbol(
  `ssrGetDynamicModelProps`,
)
export const SSR_RENDER_TELEPORT: unique symbol = Symbol(`ssrRenderTeleport`)
export const SSR_RENDER_SUSPENSE: unique symbol = Symbol(`ssrRenderSuspense`)
export const SSR_GET_DIRECTIVE_PROPS: unique symbol =
  Symbol(`ssrGetDirectiveProps`)

export const ssrHelpers: Record<symbol, string> = {
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
  [SSR_GET_DIRECTIVE_PROPS]: `ssrGetDirectiveProps`,
}

// Note: these are helpers imported from @vue/server-renderer
// make sure the names match!
registerRuntimeHelpers(ssrHelpers)
