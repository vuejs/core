import { EffectScope, pauseTracking, resetTracking } from '@vue/reactivity'
import { createComment, createTextNode } from './dom/node'
import { type Block, type BlockFn, insert, isValidBlock, remove } from './block'

export class VaporFragment {
  nodes: Block
  target?: ParentNode | null
  targetAnchor?: Node | null
  anchor?: Node
  insert?: (parent: ParentNode, anchor: Node | null) => void
  remove?: (parent?: ParentNode) => void
  getNodes?: () => Block

  constructor(nodes: Block) {
    this.nodes = nodes
  }
}

export class DynamicFragment extends VaporFragment {
  anchor: Node
  scope: EffectScope | undefined
  current?: BlockFn
  fallback?: BlockFn

  constructor(anchorLabel?: string) {
    super([])
    this.anchor =
      __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.current) {
      return
    }
    this.current = key

    pauseTracking()
    const parent = this.anchor.parentNode

    // teardown previous branch
    if (this.scope) {
      this.scope.stop()
      parent && remove(this.nodes, parent)
    }

    if (render) {
      this.scope = new EffectScope()
      this.nodes = this.scope.run(render) || []
      if (parent) insert(this.nodes, parent, this.anchor)
    } else {
      this.scope = undefined
      this.nodes = []
    }

    if (this.fallback && !isValidBlock(this.nodes)) {
      parent && remove(this.nodes, parent)
      this.nodes =
        (this.scope || (this.scope = new EffectScope())).run(this.fallback) ||
        []
      parent && insert(this.nodes, parent, this.anchor)
    }

    resetTracking()
  }
}

export function isFragment(val: NonNullable<unknown>): val is VaporFragment {
  return val instanceof VaporFragment
}
