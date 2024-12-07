import { isArray } from '@vue/shared'
import { type VaporComponentInstance, isVaporComponent } from './component'
import { createComment, insert, remove } from './dom/node'
import { EffectScope } from '@vue/reactivity'

export type Block = Node | Fragment | VaporComponentInstance | Block[]

export type BlockFn = (...args: any[]) => Block

export class Fragment {
  nodes: Block
  anchor?: Node

  constructor(nodes: Block) {
    this.nodes = nodes
  }
}

export class DynamicFragment extends Fragment {
  anchor: Node
  scope: EffectScope | undefined
  key: any

  constructor(anchorLabel?: string) {
    super([])
    this.anchor =
      __DEV__ && anchorLabel
        ? createComment(anchorLabel)
        : // eslint-disable-next-line no-restricted-globals
          document.createTextNode('')
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.key) return
    this.key = key

    const parent = this.anchor.parentNode

    // teardown previous branch
    if (this.scope) {
      this.scope.off()
      parent && remove(this.nodes, parent)
    }

    if (render) {
      this.scope = new EffectScope()
      this.nodes = this.scope.run(render) || []
      if (parent) insert(this.nodes, parent)
    } else {
      this.scope = undefined
      this.nodes = []
    }
  }
}

export function isFragment(val: NonNullable<unknown>): val is Fragment {
  return val instanceof Fragment
}

export function isBlock(val: NonNullable<unknown>): val is Block {
  return (
    val instanceof Node ||
    isArray(val) ||
    isVaporComponent(val) ||
    isFragment(val)
  )
}

/*! #__NO_SIDE_EFFECTS__ */
// TODO this should be optimized away
export function normalizeBlock(block: Block): Node[] {
  const nodes: Node[] = []
  if (block instanceof Node) {
    nodes.push(block)
  } else if (isArray(block)) {
    block.forEach(child => nodes.push(...normalizeBlock(child)))
  } else if (isVaporComponent(block)) {
    nodes.push(...normalizeBlock(block.block!))
  } else if (block) {
    nodes.push(...normalizeBlock(block.nodes))
    block.anchor && nodes.push(block.anchor)
  }
  return nodes
}

export function findFirstRootElement(
  instance: VaporComponentInstance,
): Element | undefined {
  const element = getFirstNode(instance.block)
  return element instanceof Element ? element : undefined
}

export function getFirstNode(block: Block | null): Node | undefined {
  if (!block || isVaporComponent(block)) return
  if (block instanceof Node) return block
  if (isArray(block)) {
    if (block.length === 1) {
      return getFirstNode(block[0])
    }
  } else {
    return getFirstNode(block.nodes)
  }
}

// TODO optimize
export function isValidBlock(block: Block): boolean {
  return (
    normalizeBlock(block).filter(node => !(node instanceof Comment)).length > 0
  )
}
