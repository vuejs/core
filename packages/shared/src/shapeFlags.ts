export enum ShapeFlags {
  ELEMENT = 1,
  FUNCTIONAL_COMPONENT = 1 << 1,
  STATEFUL_COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  SLOTS_CHILDREN = 1 << 5,
  TELEPORT = 1 << 6,
  SUSPENSE = 1 << 7,
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  COMPONENT_KEPT_ALIVE = 1 << 9,
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT,
}

export const isElementVNode = (flag: number) => flag & ShapeFlags.ELEMENT

export const isFunctionalComponentVNode = (flag: number) =>
  flag & ShapeFlags.FUNCTIONAL_COMPONENT

export const isStatefulComponentVNode = (flag: number) =>
  flag & ShapeFlags.STATEFUL_COMPONENT

export const isTextChildrenVNode = (flag: number) =>
  flag & ShapeFlags.TEXT_CHILDREN

export const isArrayChildrenVNode = (flag: number) =>
  flag & ShapeFlags.ARRAY_CHILDREN

export const isSlotsChildrenVNode = (flag: number) =>
  flag & ShapeFlags.SLOTS_CHILDREN

export const isTeleportVNode = (flag: number) => flag & ShapeFlags.TELEPORT

export const isSuspenseVNode = (flag: number) => flag & ShapeFlags.SUSPENSE

export const isComponentShouldKeepAliveVNode = (flag: number) =>
  flag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE

export const isComponentKeptAliveVNode = (flag: number) =>
  flag & ShapeFlags.COMPONENT_KEPT_ALIVE

export const isComponentVNode = (flag: number) => flag & ShapeFlags.COMPONENT

export const isCustomTypeVNode = (flag: number, customFlag: number) =>
  flag & customFlag
