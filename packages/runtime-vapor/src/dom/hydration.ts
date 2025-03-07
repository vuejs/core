import { child, next } from './node'

export let isHydrating = false
export let currentHydrationNode: Node | null = null

export function setCurrentHydrationNode(node: Node | null): void {
  currentHydrationNode = node
}

let isOptimized = false

export function withHydration(container: ParentNode, fn: () => void): void {
  adoptHydrationNode = adoptHydrationNodeImpl
  if (!isOptimized) {
    // optimize anchor cache lookup
    const proto = Comment.prototype as any
    proto.$p = proto.$e = undefined
    isOptimized = true
  }
  isHydrating = true
  currentHydrationNode = child(container)
  const res = fn()
  isHydrating = false
  currentHydrationNode = null
  return res
}

export let adoptHydrationNode: (
  node: Node | null,
  template?: string,
) => Node | null

type Anchor = Comment & {
  // previous open anchor
  $p?: Anchor
  // matching end anchor
  $e?: Anchor
}

const isComment = (node: Node, data: string): node is Anchor =>
  node.nodeType === 8 && (node as Comment).data === data

/**
 * Locate the first non-fragment-comment node and locate the next node
 * while handling potential fragments.
 */
function adoptHydrationNodeImpl(
  node: Node | null,
  template?: string,
): Node | null {
  if (!isHydrating || !node) {
    return node
  }

  let adopted: Node | undefined
  let end: Node | undefined | null

  if (template) {
    if (template[0] !== '<' && template[1] !== '!') {
      while (node.nodeType === 8) node = next(node)
    }
    adopted = end = node
  } else if (isComment(node, '[')) {
    // fragment
    let start = node
    let cur: Node = node
    let fragmentDepth = 1
    // previously recorded fragment end
    if (!end && node.$e) {
      end = node.$e
    }
    while (true) {
      cur = next(cur)
      if (isComment(cur, '[')) {
        // previously recorded fragment end
        if (!end && node.$e) {
          end = node.$e
        }
        fragmentDepth++
        cur.$p = start
        start = cur
      } else if (isComment(cur, ']')) {
        fragmentDepth--
        // record fragment end on start node for later traversal
        start.$e = cur
        start = start.$p!
        if (!fragmentDepth) {
          // fragment end
          end = cur
          break
        }
      } else if (!adopted) {
        adopted = cur
        if (end) {
          break
        }
      }
    }
    if (!adopted) {
      throw new Error('hydration mismatch')
    }
  } else {
    adopted = end = node
  }

  if (__DEV__ && template) {
    const type = adopted.nodeType
    if (
      (type === 8 && !template.startsWith('<!')) ||
      (type === 1 &&
        !template.startsWith(
          `<` + (adopted as Element).tagName.toLowerCase(),
        )) ||
      (type === 3 &&
        template.trim() &&
        !template.startsWith((adopted as Text).data))
    ) {
      // TODO recover and provide more info
      throw new Error('hydration mismatch!')
    }
  }

  currentHydrationNode = next(end!)
  return adopted
}
