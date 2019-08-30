// internally the const enum flags are used to avoid overhead of property
// access
export const enum ShapeFlags {
  ELEMENT = 1,
  FUNCTIONAL_COMPONENT = 1 << 1,
  STATEFUL_COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  SLOTS_CHILDREN = 1 << 5,
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
}

// but the flags are also exported as an actual object for external use
export const PublicShapeFlags = {
  ELEMENT: ShapeFlags.ELEMENT,
  FUNCTIONAL_COMPONENT: ShapeFlags.FUNCTIONAL_COMPONENT,
  STATEFUL_COMPONENT: ShapeFlags.STATEFUL_COMPONENT,
  TEXT_CHILDREN: ShapeFlags.TEXT_CHILDREN,
  ARRAY_CHILDREN: ShapeFlags.ARRAY_CHILDREN,
  SLOTS_CHILDREN: ShapeFlags.SLOTS_CHILDREN,
  COMPONENT: ShapeFlags.COMPONENT
}
