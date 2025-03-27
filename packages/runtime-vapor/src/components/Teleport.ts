import {
  TeleportEndKey,
  type TeleportProps,
  currentInstance,
  isTeleportDeferred,
  isTeleportDisabled,
  queuePostFlushCb,
  resolveTarget,
  warn,
} from '@vue/runtime-dom'
import { type Block, type BlockFn, insert, remove } from '../block'
import { createComment, createTextNode, querySelector } from '../dom/node'
import type {
  LooseRawProps,
  LooseRawSlots,
  VaporComponentInstance,
} from '../component'
import { rawPropsProxyHandlers } from '../componentProps'
import { renderEffect } from '../renderEffect'
import { extend, isArray } from '@vue/shared'
import { VaporFragment } from '../fragment'

export const teleportStack: TeleportFragment[] = __DEV__
  ? ([] as TeleportFragment[])
  : (undefined as any)
export const instanceToTeleportMap: WeakMap<
  VaporComponentInstance,
  TeleportFragment
> = __DEV__ ? new WeakMap() : (undefined as any)

/**
 * dev only
 * when the root child component updates, synchronously update
 * the TeleportFragment's nodes.
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

export const VaporTeleportImpl = {
  name: 'VaporTeleport',
  __isTeleport: true,
  __vapor: true,

  process(props: LooseRawProps, slots: LooseRawSlots): TeleportFragment {
    const frag = __DEV__
      ? new TeleportFragment('teleport')
      : new TeleportFragment()

    const updateChildrenEffect = renderEffect(() => {
      __DEV__ && teleportStack.push(frag)
      frag.updateChildren(slots.default && (slots.default as BlockFn)())
      __DEV__ && teleportStack.pop()
    })

    const updateEffect = renderEffect(() => {
      frag.update(
        // access the props to trigger tracking
        extend(
          {},
          new Proxy(props, rawPropsProxyHandlers) as any as TeleportProps,
        ),
      )
    })

    if (__DEV__) {
      // used in `normalizeBlock` to get nodes of TeleportFragment during
      // HMR updates. returns empty array if content is mounted in target
      // container to prevent incorrect parent node lookup.
      frag.getNodes = () => {
        return frag.parent !== frag.currentParent ? [] : frag.nodes
      }

      // for HMR re-render
      const instance = currentInstance as VaporComponentInstance
      ;(
        instance!.hmrRerenderEffects || (instance!.hmrRerenderEffects = [])
      ).push(() => {
        // remove the teleport content
        frag.remove(frag.anchor.parentNode!)

        // stop effects
        updateChildrenEffect.stop()
        updateEffect.stop()
      })
    }

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
    // not mounted yet
    if (!this.parent) {
      this.nodes = children
    } else {
      // teardown previous nodes
      remove(this.nodes, this.currentParent)
      // mount new nodes
      insert((this.nodes = children), this.currentParent, this.currentAnchor)
    }
  }

  update(props: TeleportProps): void {
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

export const VaporTeleport = VaporTeleportImpl as unknown as {
  __vapor: true
  __isTeleport: true
  new (): {
    $props: TeleportProps
    $slots: {
      default(): Block
    }
  }
}
