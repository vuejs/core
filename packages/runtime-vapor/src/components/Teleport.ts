import {
  type TeleportProps,
  isTeleportDeferred,
  isTeleportDisabled,
  onScopeDispose,
  queuePostFlushCb,
  resolveTeleportTarget,
  warn,
} from '@vue/runtime-dom'
import { type Block, type BlockFn, insert, remove } from '../block'
import { createComment, createTextNode, querySelector } from '../dom/node'
import {
  type LooseRawProps,
  type LooseRawSlots,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { rawPropsProxyHandlers } from '../componentProps'
import { renderEffect } from '../renderEffect'
import { extend, isArray } from '@vue/shared'
import { VaporFragment } from '../fragment'

const instanceToTeleportMap: WeakMap<VaporComponentInstance, TeleportFragment> =
  __DEV__ ? new WeakMap() : (undefined as any)

export const VaporTeleportImpl = {
  name: 'VaporTeleport',
  __isTeleport: true,
  __vapor: true,

  process(props: LooseRawProps, slots: LooseRawSlots): TeleportFragment {
    const frag = new TeleportFragment()
    renderEffect(() =>
      frag.updateChildren(slots.default && (slots.default as BlockFn)()),
    )

    renderEffect(() => {
      // access the props to trigger tracking
      frag.props = extend(
        {},
        new Proxy(props, rawPropsProxyHandlers) as any as TeleportProps,
      )
      frag.update()
    })

    onScopeDispose(() => {
      frag.remove()
    })

    if (__DEV__) {
      // used in `normalizeBlock` to get nodes of TeleportFragment during
      // HMR updates. returns empty array if content is mounted in target
      // container to prevent incorrect parent node lookup.
      frag.getNodes = () => {
        return frag.parent !== frag.currentParent ? [] : frag.nodes
      }

      // for HMR reload
      const nodes = frag.nodes
      if (isVaporComponent(nodes)) {
        instanceToTeleportMap.set(nodes, frag)
      } else if (isArray(nodes)) {
        nodes.forEach(
          node =>
            isVaporComponent(node) && instanceToTeleportMap.set(node, frag),
        )
      }
    }

    return frag
  },
}

export class TeleportFragment extends VaporFragment {
  target?: ParentNode | null
  targetAnchor?: Node | null
  anchor: Node
  props?: TeleportProps

  private targetStart?: Node
  private mainAnchor?: Node
  private placeholder?: Node
  private mountContainer?: ParentNode | null
  private mountAnchor?: Node | null

  constructor() {
    super([])
    this.anchor = createTextNode()
  }

  get currentParent(): ParentNode {
    return (this.mountContainer || this.parent)!
  }

  get currentAnchor(): Node | null {
    return this.mountAnchor || this.anchor
  }

  get parent(): ParentNode | null {
    return this.anchor && this.anchor.parentNode
  }

  updateChildren(children: Block): void {
    // not mounted yet
    if (!this.parent) {
      this.nodes = children
      return
    }

    // teardown previous nodes
    remove(this.nodes, this.currentParent)
    // mount new nodes
    insert((this.nodes = children), this.currentParent, this.currentAnchor)
  }

  update(): void {
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
        this.props!,
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
    if (isTeleportDisabled(this.props!)) {
      mount(this.parent, this.mainAnchor!)
    }
    // mount into target container
    else {
      if (isTeleportDeferred(this.props!)) {
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
    this.mainAnchor = __DEV__ ? createComment('teleport end') : createTextNode()
    insert(this.placeholder, container, anchor)
    insert(this.mainAnchor, container, anchor)
    this.update()
  }

  remove = (parent: ParentNode | undefined = this.parent!): void => {
    // remove nodes
    if (this.nodes) {
      remove(this.nodes, this.currentParent)
      this.nodes = []
    }

    // remove anchors
    if (this.targetStart) {
      remove(this.targetStart!, this.target!)
      this.targetStart = undefined
      remove(this.targetAnchor!, this.target!)
      this.targetAnchor = undefined
    }

    if (this.placeholder) {
      remove(this.placeholder!, parent)
      this.placeholder = undefined
      remove(this.mainAnchor!, parent)
      this.mainAnchor = undefined
    }

    this.mountContainer = undefined
    this.mountAnchor = undefined
  }

  hydrate = (): void => {
    // TODO
  }
}

export function isVaporTeleport(
  value: unknown,
): value is typeof VaporTeleportImpl {
  return value === VaporTeleportImpl
}

/**
 * dev only
 * during root component HMR reload, since the old component will be unmounted
 * and a new one will be mounted, we need to update the teleport's nodes
 * to ensure they are up to date.
 */
export function handleTeleportRootComponentHmrReload(
  instance: VaporComponentInstance,
  newInstance: VaporComponentInstance,
): void {
  const teleport = instanceToTeleportMap.get(instance)
  if (teleport) {
    instanceToTeleportMap.set(newInstance, teleport)
    if (teleport.nodes === instance) {
      teleport.nodes = newInstance
    } else if (isArray(teleport.nodes)) {
      const i = teleport.nodes.indexOf(instance)
      if (i !== -1) teleport.nodes[i] = newInstance
    }
  }
}
