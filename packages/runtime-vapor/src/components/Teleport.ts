import {
  TeleportEndKey,
  type TeleportProps,
  isTeleportDeferred,
  isTeleportDisabled,
  queuePostFlushCb,
  resolveTarget,
  warn,
} from '@vue/runtime-dom'
import {
  type Block,
  type BlockFn,
  VaporFragment,
  insert,
  remove,
} from '../block'
import { createComment, createTextNode, querySelector } from '../dom/node'
import type { LooseRawProps, LooseRawSlots } from '../component'
import { rawPropsProxyHandlers } from '../componentProps'
import { renderEffect } from '../renderEffect'
import { extend } from '@vue/shared'

export const VaporTeleportImpl = {
  name: 'VaporTeleport',
  __isTeleport: true,
  __vapor: true,

  process(props: LooseRawProps, slots: LooseRawSlots): TeleportFragment {
    const frag = __DEV__
      ? new TeleportFragment('teleport')
      : new TeleportFragment()

    let children: Block
    renderEffect(() => {
      frag.updateChildren(
        (children = slots.default && (slots.default as BlockFn)()),
      )
    })

    renderEffect(() => {
      frag.update(
        // access the props to trigger tracking
        extend(
          {},
          new Proxy(props, rawPropsProxyHandlers) as any as TeleportProps,
        ),
        children!,
      )
    })

    return frag
  },
}

class TeleportFragment extends VaporFragment {
  anchor: Node

  private targetStart?: Node
  private mainAnchor?: Node
  private placeholder?: Node
  private mountContainer?: ParentNode | null
  private mountAnchor?: Node | null

  constructor(anchorLabel?: string) {
    super([])
    this.anchor =
      __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
  }

  get currentParent(): ParentNode {
    return (this.mountContainer || this.parent)!
  }

  get currentAnchor(): Node | null {
    return this.mountAnchor || this.anchor
  }

  get parent(): ParentNode | null {
    return this.anchor.parentNode
  }

  updateChildren(children: Block): void {
    // not mounted yet, early return
    if (!this.parent) return

    // teardown previous children
    remove(this.nodes, this.currentParent)

    // mount new
    insert((this.nodes = children), this.currentParent, this.currentAnchor)
  }

  update(props: TeleportProps, children: Block): void {
    this.nodes = children

    const mount = (parent: ParentNode, anchor: Node | null) => {
      insert(
        this.nodes,
        (this.mountContainer = parent),
        (this.mountAnchor = anchor),
      )
    }

    const mountToTarget = () => {
      const target = (this.target = resolveTarget(props, querySelector))
      if (target) {
        if (
          // initial mount into target
          !this.targetAnchor ||
          // target changed
          this.targetAnchor.parentNode !== target
        ) {
          ;[this.targetAnchor, this.targetStart] = prepareAnchor(target)
        }

        mount(target, this.targetAnchor!)
      } else if (__DEV__) {
        warn(
          `Invalid Teleport target on ${this.targetAnchor ? 'update' : 'mount'}:`,
          target,
          `(${typeof target})`,
        )
      }
    }

    // mount into main container
    if (isTeleportDisabled(props)) {
      if (this.parent) {
        if (!this.mainAnchor) {
          this.mainAnchor = __DEV__
            ? createComment('teleport end')
            : createTextNode()
        }
        if (!this.placeholder) {
          this.placeholder = __DEV__
            ? createComment('teleport start')
            : createTextNode()
        }
        if (!this.mainAnchor.isConnected) {
          insert(this.placeholder, this.parent, this.anchor)
          insert(this.mainAnchor, this.parent, this.anchor)
        }

        mount(this.parent, this.mainAnchor)
      }
    }
    // mount into target container
    else {
      if (isTeleportDeferred(props)) {
        queuePostFlushCb(mountToTarget)
      } else {
        mountToTarget()
      }
    }
  }

  remove = (parent: ParentNode | undefined): void => {
    // remove nodes
    remove(this.nodes, this.currentParent)

    // remove anchors
    if (this.targetStart) {
      remove(this.targetStart!, this.target!)
      remove(this.targetAnchor!, this.target!)
    }
    if (this.placeholder) {
      remove(this.placeholder!, parent)
      remove(this.mainAnchor!, parent)
    }
  }

  hydrate(): void {
    // TODO
  }
}

function prepareAnchor(target: ParentNode | null) {
  const targetStart = createTextNode('') as Text & { [TeleportEndKey]: Node }
  const targetAnchor = createTextNode('')

  // attach a special property, so we can skip teleported content in
  // renderer's nextSibling search
  targetStart[TeleportEndKey] = targetAnchor

  if (target) {
    insert(targetStart, target)
    insert(targetAnchor, target)
  }

  return [targetAnchor, targetStart]
}
