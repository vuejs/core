export const FRAGMENT = Symbol()
export const PORTAL = Symbol()
export const COMMENT = Symbol()
export const TEXT = Symbol()
export const SUSPENSE = Symbol()
export const EMPTY = Symbol()
export const OPEN_BLOCK = Symbol()
export const CREATE_BLOCK = Symbol()
export const CREATE_VNODE = Symbol()
export const RESOLVE_COMPONENT = Symbol()
export const RESOLVE_DIRECTIVE = Symbol()
export const APPLY_DIRECTIVES = Symbol()
export const RENDER_LIST = Symbol()
export const RENDER_SLOT = Symbol()
export const CREATE_SLOTS = Symbol()
export const TO_STRING = Symbol()
export const MERGE_PROPS = Symbol()
export const TO_HANDLERS = Symbol()
export const CAMELIZE = Symbol()

export type RuntimeHelper =
  | typeof FRAGMENT
  | typeof PORTAL
  | typeof COMMENT
  | typeof TEXT
  | typeof SUSPENSE
  | typeof EMPTY
  | typeof OPEN_BLOCK
  | typeof CREATE_BLOCK
  | typeof CREATE_VNODE
  | typeof RESOLVE_COMPONENT
  | typeof RESOLVE_DIRECTIVE
  | typeof APPLY_DIRECTIVES
  | typeof RENDER_LIST
  | typeof RENDER_SLOT
  | typeof CREATE_SLOTS
  | typeof TO_STRING
  | typeof MERGE_PROPS
  | typeof TO_HANDLERS
  | typeof CAMELIZE

// Name mapping for runtime helpers that need to be imported from 'vue' in
// generated code. Make sure these are correctly exported in the runtime!
export const helperNameMap = {
  [FRAGMENT]: `Fragment`,
  [PORTAL]: `Portal`,
  [COMMENT]: `Comment`,
  [TEXT]: `Text`,
  [SUSPENSE]: `Suspense`,
  [EMPTY]: `Empty`,
  [OPEN_BLOCK]: `openBlock`,
  [CREATE_BLOCK]: `createBlock`,
  [CREATE_VNODE]: `createVNode`,
  [RESOLVE_COMPONENT]: `resolveComponent`,
  [RESOLVE_DIRECTIVE]: `resolveDirective`,
  [APPLY_DIRECTIVES]: `applyDirectives`,
  [RENDER_LIST]: `renderList`,
  [RENDER_SLOT]: `renderSlot`,
  [CREATE_SLOTS]: `createSlots`,
  [TO_STRING]: `toString`,
  [MERGE_PROPS]: `mergeProps`,
  [TO_HANDLERS]: `toHandlers`,
  [CAMELIZE]: `camelize`
}
