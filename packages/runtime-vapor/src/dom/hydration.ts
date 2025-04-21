import { warn } from '@vue/runtime-dom'
import {
  type Anchor,
  insertionAnchor,
  insertionParent,
  resetInsertionState,
  setInsertionState,
} from '../insertionState'
import { child, next } from './node'

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
  isHydrating = true
  setInsertionState(container, 0)
  const res = fn()
  resetInsertionState()
  currentHydrationNode = null
  isHydrating = false
  return res
}

export let adoptTemplate: (node: Node, template: string) => Node | null
export let locateHydrationNode: () => void

const isComment = (node: Node, data: string): node is Anchor =>
  node.nodeType === 8 && (node as Comment).data === data

/**
 * Locate the first non-fragment-comment node and locate the next node
 * while handling potential fragments.
 */
function adoptTemplateImpl(node: Node, template: string): Node | null {
  if (!(template[0] === '<' && template[1] === '!')) {
    while (node.nodeType === 8) node = next(node)
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

function locateHydrationNodeImpl() {
  let node: Node | null
  // prepend / firstChild
  if (insertionAnchor === 0) {
    node = child(insertionParent!)
  } else {
    // dynamic child anchor `<!--[[-->`
    if (insertionAnchor && isDynamicStart(insertionAnchor)) {
      const anchor = (insertionParent!.lds = insertionParent!.lds
        ? // continuous dynamic children, the next dynamic start must exist
          locateNextDynamicStart(insertionParent!.lds)!
        : insertionAnchor)
      node = anchor.nextSibling
    } else {
      node = insertionAnchor
        ? insertionAnchor.previousSibling
        : insertionParent
          ? insertionParent.lastChild
          : currentHydrationNode
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
  }

  if (__DEV__ && !node) {
    // TODO more info
    warn('Hydration mismatch in ', insertionParent)
  }

  resetInsertionState()
  currentHydrationNode = node
}

function isDynamicStart(node: Node): node is Anchor {
  return isComment(node, '[[')
}

function locateNextDynamicStart(anchor: Anchor): Anchor | undefined {
  let cur: Node | null = anchor
  let end = null
  let depth = 0
  while (cur) {
    cur = cur.nextSibling
    if (cur) {
      if (isComment(cur, '[[')) {
        depth++
      } else if (isComment(cur, ']]')) {
        if (!depth) {
          end = cur
          break
        } else {
          depth--
        }
      }
    }
  }

  if (end) {
    return end!.nextSibling as Anchor
  }
}
