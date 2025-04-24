import { isDynamicFragmentEndAnchor, warn } from '@vue/runtime-dom'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
  setInsertionState,
} from '../insertionState'
import {
  child,
  disableHydrationNodeLookup,
  enableHydrationNodeLookup,
  next,
  prev,
} from './node'

export let isHydrating = false
export let currentHydrationNode: Node | null = null

export function setCurrentHydrationNode(node: Node | null): void {
  currentHydrationNode = node
}

let isOptimized = false

export function withHydration(container: ParentNode, fn: () => void): void {
  adoptTemplate = adoptTemplateImpl
  locateHydrationNode = locateHydrationNodeImpl
  if (!isOptimized) {
    // optimize anchor cache lookup
    ;(Comment.prototype as any).$fs = undefined
    isOptimized = true
  }
  enableHydrationNodeLookup()
  isHydrating = true
  setInsertionState(container, 0)
  const res = fn()
  resetInsertionState()
  currentHydrationNode = null
  isHydrating = false
  disableHydrationNodeLookup()
  return res
}

export let adoptTemplate: (node: Node, template: string) => Node | null
export let locateHydrationNode: (isFragment?: boolean) => void

type Anchor = Comment & {
  // cached matching fragment start to avoid repeated traversal
  // on nested fragments
  $fs?: Anchor
}

export const isComment = (node: Node, data: string): node is Anchor =>
  node.nodeType === 8 && (node as Comment).data === data

/**
 * Locate the first non-fragment-comment node and locate the next node
 * while handling potential fragments.
 */
function adoptTemplateImpl(node: Node, template: string): Node | null {
  if (!(template[0] === '<' && template[1] === '!')) {
    while (node.nodeType === 8) node = node.nextSibling!
  }

  if (__DEV__) {
    const type = node.nodeType
    if (
      (type === 8 && !template.startsWith('<!')) ||
      (type === 1 &&
        !template.startsWith(`<` + (node as Element).tagName.toLowerCase())) ||
      (type === 3 &&
        template.trim() &&
        !template.startsWith((node as Text).data))
    ) {
      // TODO recover and provide more info
      warn(`adopted: `, node)
      warn(`template: ${template}`)
      warn('hydration mismatch!')
    }
  }

  currentHydrationNode = next(node)
  return node
}

function locateHydrationNodeImpl(isFragment?: boolean) {
  let node: Node | null
  // prepend / firstChild
  if (insertionAnchor === 0) {
    node = child(insertionParent!)
  } else if (insertionAnchor) {
    // for dynamic children, use insertionAnchor as the node
    node = insertionAnchor
  } else {
    node = insertionParent ? insertionParent.lastChild : currentHydrationNode

    // if the last child is a comment, it is the anchor for the fragment
    // so it need to find the previous node
    if (isFragment && node && isDynamicFragmentEndAnchor(node)) {
      let previous = prev(node)
      if (previous) node = previous
    }

    if (node && isComment(node, ']')) {
      // fragment backward search
      if (node.$fs) {
        // already cached matching fragment start
        node = node.$fs
      } else {
        let cur: Node | null = node
        let curFragEnd = node
        let fragDepth = 0
        node = null
        while (cur) {
          cur = cur.previousSibling
          if (cur) {
            if (isComment(cur, '[')) {
              curFragEnd.$fs = cur
              if (!fragDepth) {
                node = cur
                break
              } else {
                fragDepth--
              }
            } else if (isComment(cur, ']')) {
              curFragEnd = cur
              fragDepth++
            }
          }
        }
      }
    }
  }

  if (__DEV__ && !node) {
    // TODO more info
    warn('Hydration mismatch in ', insertionParent)
  }

  resetInsertionState()
  currentHydrationNode = node
}

export function isEmptyText(node: Node): node is Text {
  return node.nodeType === 3 && !(node as Text).data.trim()
}

export function locateEndAnchor(
  node: Node | null,
  open = '[',
  close = ']',
): Node | null {
  let match = 0
  while (node) {
    node = node.nextSibling
    if (node && node.nodeType === 8) {
      if ((node as Comment).data === open) match++
      if ((node as Comment).data === close) {
        if (match === 0) {
          return node
        } else {
          match--
        }
      }
    }
  }
  return null
}

export function locateStartAnchor(
  node: Node | null,
  open = '[',
  close = ']',
): Node | null {
  let match = 0
  while (node) {
    if (node.nodeType === 8) {
      if ((node as Comment).data === close) match++
      if ((node as Comment).data === open) {
        if (match === 0) {
          return node
        } else {
          match--
        }
      }
    }
    node = node.previousSibling
  }
  return null
}
