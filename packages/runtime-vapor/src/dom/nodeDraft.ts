export type VaporNode<N extends Node = Node, D extends NodeDraft = NodeDraft> =
  | N
  | NodeRef<boolean, N, D>

export type VaporParentNode<
  N extends ParentNode = ParentNode,
  D extends NodeDraft = NodeDraft,
> = N | NodeRef<boolean, N, D>

export type MaybeNodeDraft = Node | NodeDraft

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
  get ref(): T extends true ? N : D {
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
    private __v_parentNode: NodeRef<false> | null = null,
  ) {
    unenumerable(this, '__v_nodeRef')
    unenumerable(this, '__v_childNodes')
    unenumerable(this, '__v_parentNode')
  }

  get parentNode(): NodeRef | null {
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
  public textContent: string = ''
}

export class CommentDraft extends NodeDraft {
  public data: string = ''
}

export function toNode(node: VaporNode): MaybeNodeDraft {
  return node instanceof NodeRef ? node.ref : node
}

export function isUnresolvedNode(node: VaporNode): node is NodeRef<false> {
  return node instanceof NodeRef && !node.resolved
}
