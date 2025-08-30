export type VaporNode<N extends Node = Node, D extends NodeDraft = NodeDraft> =
  | N
  | NodeRef<boolean, N, D>

export type VaporParentNode<
  N extends ParentNode = ParentNode,
  D extends NodeDraft = NodeDraft,
> =
  | (N & { $anchor?: Node | null })
  | NodeRef<
      boolean,
      N & { $anchor?: Node | null },
      D & { $anchor?: VaporNode | null }
    >

export type MaybeNodeDraft<
  N extends Node = Node,
  D extends NodeDraft = NodeDraft,
> = N | D

function unenumerable(obj: any, key: string | symbol) {
  Object.defineProperty(obj, key, {
    enumerable: false,
  })
}

type Constructor<T> = new (ref: NodeRef) => T

export class NodeRef<
  T extends boolean = boolean,
  N extends Node = Node,
  D extends NodeDraft = NodeDraft,
> {
  get ref(): typeof this.resolved extends true ? N : D {
    return this.resolved ? (this.source! as any) : (this.draft as any)
  }
  private source?: N
  private draft?: D

  constructor(NodeDraftClass: Constructor<D> = NodeDraft as Constructor<D>) {
    this.draft = new NodeDraftClass(this)
  }

  get resolved(): T {
    return (this.draft === undefined) as T
  }

  resolve(theRef: N): void {
    if (this.resolved) {
      throw new Error('HydrationNode has already been resolved')
    }
    this.source = theRef
    ;(Object.keys(this.ref) as Array<keyof NodeDraft>).forEach(key => {
      const newValue = this.draft![key]
      const oldValue = theRef[key]
      if (newValue !== oldValue) {
        ;(theRef as any)[key] = newValue
      }
    })
    this.draft = undefined
  }
}

export class NodeDraft {
  constructor(
    private __v_nodeRef: NodeRef,
    private __v_childNodes: NodeRef<false>[] = [],
    private __v_parentNode: NodeRef<false, ParentNode> | null = null,
  ) {
    unenumerable(this, '__v_nodeRef')
    unenumerable(this, '__v_childNodes')
    unenumerable(this, '__v_parentNode')
  }

  get parentNode(): NodeRef<boolean, ParentNode> | null {
    return this.__v_parentNode
  }

  get childNodes(): NodeRef[] {
    return this.__v_childNodes
  }

  get firstChild(): NodeRef | null {
    return this.childNodes[0] || null
  }

  get nextSibling(): NodeRef | null {
    const parent = this.__v_parentNode
    if (!parent) return null
    const index = parent.ref.childNodes.indexOf(this.__v_nodeRef)
    return parent.ref.childNodes[index + 1] || null
  }
}

export class TextNodeDraft extends NodeDraft {
  public textContent: string | null = null
  public nodeValue: string | null = null
  public $txt?: string
}

export class CommentDraft extends NodeDraft {
  public data: string = ''
}

type ToNode<T extends VaporNode> =
  T extends VaporNode<infer N, infer D> ? MaybeNodeDraft<N, D> : never

export function toNode<T>(
  node: T,
): T extends NodeRef
  ? T['ref']
  : T extends Node
    ? T
    : T extends VaporNode
      ? ToNode<T>
      : T {
  return node instanceof NodeRef ? (node.ref as any) : (node as any)
}

export function isUnresolvedVaporNode(node: VaporNode): node is NodeRef<false> {
  return node instanceof NodeRef && !node.resolved
}

/**
 * # Functionality:
 *
 * ## Resolve Nodes
 * Find the actual Node based on the Ref tree and set it to the Ref. We call this behavior resolution.
 *
 * ## Patch Nodes
 * Compare the differences between the real nodes found in the Ref tree and the previous Draft, and apply patches.
 * If differences exist, we need to update the node values to the actual Draft values.
 *
 * @param block
 * @param parent
 * @param anchor
 */
export function nodeDraftPatch(
  block: NodeRef | NodeRef[],
  parent: ParentNode & { $anchor?: Node | null },
  anchor: Node | null | 0 = null, // 0 means prepend
): void {
  let anchorIndex = -1

  anchor = anchor === 0 ? parent.$anchor || parent.firstChild : anchor

  if (!Array.isArray(block)) {
    block = [block]
  }

  if (anchor) {
    anchorIndex = getNodeIndexOf(parent, anchor)
    if (anchorIndex === -1) {
      throw new Error('anchor node is not a child of parent')
    }
    anchorIndex = anchorIndex - block.length
  } else {
    anchorIndex = 0
  }

  _nodeDraftPatch(block, parent, anchorIndex)
}

function _nodeDraftPatch(
  block: NodeRef[],
  parent: ParentNode,
  anchorIndex: number,
) {
  for (let i = 0; i < block.length; i++) {
    const nodeRef = block[i]
    if (!nodeRef || nodeRef.ref instanceof Node) {
      continue
    }

    const realNode = parent.childNodes[anchorIndex + i]

    if (!realNode) {
      if (__DEV__) throw new Error('Cannot find the real node for NodeRef')
      continue
    }

    const childNodes = nodeRef.ref.childNodes
    if (childNodes.length) {
      let $anchor = (realNode as any).$anchor
      const theChildAnchorIndex = $anchor ? getNodeIndexOf(parent, $anchor) : 0

      _nodeDraftPatch(
        childNodes,
        realNode as unknown as ParentNode,
        theChildAnchorIndex,
      )
    }

    nodeRef.resolve(realNode)
  }
}

function getNodeIndexOf(parent: ParentNode, anchor: Node | null) {
  if (!anchor) return -1
  return Array.prototype.indexOf.call(parent.childNodes, anchor)
}
