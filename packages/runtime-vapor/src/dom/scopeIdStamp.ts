export function setElementScopeIds(el: Element, scopeIds: string[]): void {
  for (let i = 0; i < scopeIds.length; i++) {
    el.setAttribute(scopeIds[i], '')
  }
}

export function setElementScopeIdsDeep(el: Element, scopeIds: string[]): void {
  setElementScopeIds(el, scopeIds)
  let child = el.firstElementChild
  while (child) {
    setElementScopeIdsDeep(child, scopeIds)
    child = child.nextElementSibling
  }
}

/**
 * Stamped-variant cache: ids are written once per (template prototype × id
 * cell) and clones inherit them via cloneNode. Never stale because scope ids
 * are compile-time constants; entries are freed with their cell (WeakMap key).
 */
const stampedTemplates = new WeakMap<Node, WeakMap<string[], Node>>()

export function cloneStampedTemplate(
  prototype: Node,
  scopeIds: string[],
): Node {
  if (prototype.nodeType !== 1 /* Node.ELEMENT_NODE */) {
    return prototype.cloneNode(true)
  }
  let variants = stampedTemplates.get(prototype)
  if (!variants) {
    stampedTemplates.set(prototype, (variants = new WeakMap()))
  }
  let stamped = variants.get(scopeIds)
  if (!stamped) {
    stamped = prototype.cloneNode(true)
    setElementScopeIdsDeep(stamped as Element, scopeIds)
    variants.set(scopeIds, stamped)
  }
  return stamped.cloneNode(true)
}
