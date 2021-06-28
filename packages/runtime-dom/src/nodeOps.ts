import { RendererOptions } from '@vue/runtime-core'

export const svgNS = 'http://www.w3.org/2000/svg'

const doc = (typeof document !== 'undefined' ? document : null) as Document

export const nodeOps: Omit<RendererOptions<Node, Element>, 'patchProp'> = {
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },

  remove: child => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },

  createElement: (tag, isSVG, is, props): Element => {
    const el = isSVG
      ? doc.createElementNS(svgNS, tag)
      : doc.createElement(tag, is ? { is } : undefined)

    if (tag === 'select' && props && props.multiple != null) {
      ;(el as HTMLSelectElement).setAttribute('multiple', props.multiple)
    }

    return el
  },

  createText: text => doc.createTextNode(text),

  createComment: text => doc.createComment(text),

  setText: (node, text) => {
    node.nodeValue = text
  },

  setElementText: (el, text) => {
    el.textContent = text
  },

  parentNode: node => node.parentNode as Element | null,

  nextSibling: node => node.nextSibling,

  querySelector: selector => doc.querySelector(selector),

  setScopeId(el, id) {
    el.setAttribute(id, '')
  },

  cloneNode(el) {
    const cloned = el.cloneNode(true)
    // #3072
    // - in `patchDOMProp`, we store the actual value in the `el._value` property.
    // - normally, elements using `:value` bindings will not be hoisted, but if
    //   the bound value is a constant, e.g. `:value="true"` - they do get
    //   hoisted.
    // - in production, hoisted nodes are cloned when subsequent inserts, but
    //   cloneNode() does not copy the custom property we attached.
    // - This may need to account for other custom DOM properties we attach to
    //   elements in addition to `_value` in the future.
    if (`_value` in el) {
      ;(cloned as any)._value = (el as any)._value
    }
    return cloned
  },

  // __UNSAFE__
  // Reason: insertAdjacentHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(content, parent, anchor, isSVG, cached) {
    if (cached) {
      let [cachedFirst, cachedLast] = cached
      let first, last
      while (true) {
        let node = cachedFirst.cloneNode(true)
        if (!first) first = node
        parent.insertBefore(node, anchor)
        if (cachedFirst === cachedLast) {
          last = node
          break
        }
        cachedFirst = cachedFirst.nextSibling!
      }
      return [first, last] as any
    }

    // <parent> before | first ... last | anchor </parent>
    const before = anchor ? anchor.previousSibling : parent.lastChild
    if (anchor) {
      let insertionPoint
      let usingTempInsertionPoint = false
      if (anchor instanceof Element) {
        insertionPoint = anchor
      } else {
        // insertAdjacentHTML only works for elements but the anchor is not an
        // element...
        usingTempInsertionPoint = true
        insertionPoint = isSVG
          ? doc.createElementNS(svgNS, 'g')
          : doc.createElement('div')
        parent.insertBefore(insertionPoint, anchor)
      }
      insertionPoint.insertAdjacentHTML('beforebegin', content)
      if (usingTempInsertionPoint) {
        parent.removeChild(insertionPoint)
      }
    } else {
      parent.insertAdjacentHTML('beforeend', content)
    }
    return [
      // first
      before ? before.nextSibling : parent.firstChild,
      // last
      anchor ? anchor.previousSibling : parent.lastChild
    ]
  }
}
