import {
  type TeleportProps,
  isTeleportDeferred,
  isTeleportDisabled,
  queuePostFlushCb,
  resolveTeleportTarget,
  warn,
} from '@vue/runtime-dom'
import { type Block, type BlockFn, insert, remove } from '../block'
import { createComment, createTextNode, querySelector } from '../dom/node'
import {
  type LooseRawProps,
  type LooseRawSlots,
  isVaporComponent,
} from '../component'
import { rawPropsProxyHandlers } from '../componentProps'
import { renderEffect } from '../renderEffect'
import { extend, isArray } from '@vue/shared'
import { VaporFragment } from '../fragment'

export const VaporTeleportImpl = {
  name: 'VaporTeleport',
  __isTeleport: true,
  __vapor: true,

  process(props: LooseRawProps, slots: LooseRawSlots): TeleportFragment {
    return new TeleportFragment(props, slots)
  },
}

export class TeleportFragment extends VaporFragment {
  anchor?: Node
  private rawProps?: LooseRawProps
  private resolvedProps?: TeleportProps
  private rawSlots?: LooseRawSlots

  target?: ParentNode | null
  targetAnchor?: Node | null
  targetStart?: Node | null

  placeholder?: Node
  mountContainer?: ParentNode | null
  mountAnchor?: Node | null

  constructor(props: LooseRawProps, slots: LooseRawSlots) {
    super([])
    this.rawProps = props
    this.rawSlots = slots
    this.anchor = __DEV__ ? createComment('teleport end') : createTextNode()

    renderEffect(() => {
      // access the props to trigger tracking
      this.resolvedProps = extend(
        {},
        new Proxy(
          this.rawProps!,
          rawPropsProxyHandlers,
        ) as any as TeleportProps,
      )
      this.handlePropsUpdate()
    })

    this.initChildren()
  }

  get parent(): ParentNode | null {
    return this.anchor ? this.anchor.parentNode : null
  }

  private initChildren(): void {
    renderEffect(() => {
      this.handleChildrenUpdate(
        this.rawSlots!.default && (this.rawSlots!.default as BlockFn)(),
      )
    })

    // for hmr
    if (__DEV__) {
      const nodes = this.nodes
      if (isVaporComponent(nodes)) {
        nodes.parentTeleport = this
      } else if (isArray(nodes)) {
        nodes.forEach(
          node => isVaporComponent(node) && (node.parentTeleport = this),
        )
      }
    }
  }

  private handleChildrenUpdate(children: Block): void {
    // not mounted yet
    if (!this.parent) {
      this.nodes = children
      return
    }

    // teardown previous nodes
    remove(this.nodes, this.mountContainer!)
    // mount new nodes
    insert((this.nodes = children), this.mountContainer!, this.mountAnchor!)
  }

  private handlePropsUpdate(): void {
    // not mounted yet
    if (!this.parent) return

    const mount = (parent: ParentNode, anchor: Node | null) => {
      insert(
        this.nodes,
        (this.mountContainer = parent),
        (this.mountAnchor = anchor),
      )
    }

    const mountToTarget = () => {
      const target = (this.target = resolveTeleportTarget(
        this.resolvedProps!,
        querySelector,
      ))
      if (target) {
        if (
          // initial mount into target
          !this.targetAnchor ||
          // target changed
          this.targetAnchor.parentNode !== target
        ) {
          insert((this.targetStart = createTextNode('')), target)
          insert((this.targetAnchor = createTextNode('')), target)
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
    if (isTeleportDisabled(this.resolvedProps!)) {
      mount(this.parent, this.anchor!)
    }
    // mount into target container
    else {
      if (isTeleportDeferred(this.resolvedProps!)) {
        queuePostFlushCb(mountToTarget)
      } else {
        mountToTarget()
      }
    }
  }

  insert = (container: ParentNode, anchor: Node | null): void => {
    // insert anchors in the main view
    this.placeholder = __DEV__
      ? createComment('teleport start')
      : createTextNode()
    insert(this.placeholder, container, anchor)
    insert(this.anchor!, container, anchor)
    this.handlePropsUpdate()
  }

  remove = (parent: ParentNode | undefined = this.parent!): void => {
    // remove nodes
    if (this.nodes) {
      remove(this.nodes, this.mountContainer!)
      this.nodes = []
    }

    // remove anchors
    if (this.targetStart) {
      remove(this.targetStart!, this.target!)
      this.targetStart = undefined
      remove(this.targetAnchor!, this.target!)
      this.targetAnchor = undefined
    }

    if (this.anchor) {
      remove(this.anchor, this.anchor.parentNode!)
      this.anchor = undefined
    }

    if (this.placeholder) {
      remove(this.placeholder!, parent)
      this.placeholder = undefined
    }

    this.mountContainer = undefined
    this.mountAnchor = undefined
  }

  hydrate = (): void => {
    //TODO
  }
}

export function isVaporTeleport(
  value: unknown,
): value is typeof VaporTeleportImpl {
  return value === VaporTeleportImpl
}
