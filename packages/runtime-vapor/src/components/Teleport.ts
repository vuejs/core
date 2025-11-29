import {
  type GenericComponentInstance,
  MismatchTypes,
  type TeleportProps,
  type TeleportTargetElement,
  isMismatchAllowed,
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
import { VaporFragment, isFragment } from '../fragment'
import {
  advanceHydrationNode,
  currentHydrationNode,
  isComment,
  isHydrating,
  logMismatchError,
  runWithoutHydration,
  setCurrentHydrationNode,
} from '../dom/hydration'
import { applyTransitionHooks } from './Transition'
import { getParentInstance } from '../componentSlots'

export const VaporTeleportImpl = {
  name: 'VaporTeleport',
  __isTeleport: true,
  __vapor: true,

  process(props: LooseRawProps, slots: LooseRawSlots): TeleportFragment {
    return new TeleportFragment(props, slots)
  },
}

export class TeleportFragment extends VaporFragment<Block[]> {
  anchor?: Node
  private rawProps?: LooseRawProps
  private resolvedProps?: TeleportProps
  private rawSlots?: LooseRawSlots
  isDisabled?: boolean

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
    this.parentComponent = getParentInstance()
    this.anchor = isHydrating
      ? undefined
      : __DEV__
        ? createComment('teleport end')
        : createTextNode()

    renderEffect(() => {
      // access the props to trigger tracking
      this.resolvedProps = extend(
        {},
        new Proxy(
          this.rawProps!,
          rawPropsProxyHandlers,
        ) as any as TeleportProps,
      )
      this.isDisabled = isTeleportDisabled(this.resolvedProps!)
      this.handlePropsUpdate()
    })

    if (!isHydrating) {
      this.initChildren()
    }
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

    const nodes = this.nodes[0]
    // register updateCssVars to root fragments's update hooks so that
    // it will be called when root fragment changed
    if (this.parentComponent && this.parentComponent.ut) {
      if (isFragment(nodes)) {
        ;(nodes.updated || (nodes.updated = [])).push(() => updateCssVars(this))
      } else if (isArray(nodes)) {
        nodes.forEach(node => {
          if (isFragment(node)) {
            ;(node.updated || (node.updated = [])).push(() =>
              updateCssVars(this),
            )
          }
        })
      }
    }

    if (__DEV__) {
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
    if (!this.parent || isHydrating) {
      // Teleport nodes are always an array, preventing attrs fallthrough
      // consistent with VDOM Teleport behavior.
      this.nodes = [children]
      return
    }

    // teardown previous nodes
    remove(this.nodes, this.mountContainer!)
    // mount new nodes
    insert((this.nodes = [children]), this.mountContainer!, this.mountAnchor!)
  }

  private mount(parent: ParentNode, anchor: Node | null): void {
    if (this.$transition) {
      this.$transition = applyTransitionHooks(this.nodes, this.$transition)
    }

    insert(
      this.nodes,
      (this.mountContainer = parent),
      (this.mountAnchor = anchor),
    )
  }

  private mountToTarget = (): void => {
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

      // track CE teleport targets
      if (this.parentComponent && this.parentComponent.isCE) {
        ;(
          this.parentComponent.ce!._teleportTargets ||
          (this.parentComponent.ce!._teleportTargets = new Set())
        ).add(target)
      }

      this.mount(target, this.targetAnchor!)
      updateCssVars(this)
    } else if (__DEV__) {
      warn(
        `Invalid Teleport target on ${this.targetAnchor ? 'update' : 'mount'}:`,
        target,
        `(${typeof target})`,
      )
    }
  }

  private handlePropsUpdate(): void {
    // not mounted yet
    if (!this.parent || isHydrating) return

    // mount into main container
    if (this.isDisabled) {
      this.mount(this.parent, this.anchor!)
      updateCssVars(this)
    }
    // mount into target container
    else {
      if (
        isTeleportDeferred(this.resolvedProps!) ||
        // force defer when the parent is not connected to the DOM,
        // typically due to an early insertion caused by setInsertionState.
        !this.parent!.isConnected
      ) {
        queuePostFlushCb(this.mountToTarget)
      } else {
        this.mountToTarget()
      }
    }
  }

  insert = (container: ParentNode, anchor: Node | null): void => {
    if (isHydrating) return

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

  private hydrateDisabledTeleport(targetNode: Node | null): void {
    let nextNode = this.placeholder!.nextSibling!
    setCurrentHydrationNode(nextNode)
    this.mountAnchor = this.anchor = locateTeleportEndAnchor(nextNode)!
    this.mountContainer = this.anchor.parentNode
    this.targetStart = targetNode
    this.targetAnchor = targetNode && targetNode.nextSibling
    this.initChildren()
  }

  private mountChildren(target: Node): void {
    target.appendChild((this.targetStart = createTextNode('')))
    target.appendChild(
      (this.mountAnchor = this.targetAnchor = createTextNode('')),
    )

    if (!isMismatchAllowed(target as Element, MismatchTypes.CHILDREN)) {
      if (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) {
        warn(
          `Hydration children mismatch on`,
          target,
          `\nServer rendered element contains fewer child nodes than client nodes.`,
        )
      }
      logMismatchError()
    }

    runWithoutHydration(this.initChildren.bind(this))
  }

  hydrate = (): void => {
    const target = (this.target = resolveTeleportTarget(
      this.resolvedProps!,
      querySelector,
    ))
    const disabled = isTeleportDisabled(this.resolvedProps!)
    this.placeholder = currentHydrationNode!
    if (target) {
      const targetNode =
        (target as TeleportTargetElement)._lpa || target.firstChild
      if (disabled) {
        this.hydrateDisabledTeleport(targetNode)
      } else {
        this.anchor = locateTeleportEndAnchor()!
        this.mountContainer = target
        let targetAnchor = targetNode
        while (targetAnchor) {
          if (targetAnchor && targetAnchor.nodeType === 8) {
            if ((targetAnchor as Comment).data === 'teleport start anchor') {
              this.targetStart = targetAnchor
            } else if ((targetAnchor as Comment).data === 'teleport anchor') {
              this.mountAnchor = this.targetAnchor = targetAnchor
              ;(target as TeleportTargetElement)._lpa =
                this.targetAnchor && this.targetAnchor.nextSibling
              break
            }
          }
          targetAnchor = targetAnchor.nextSibling
        }

        if (targetNode) {
          setCurrentHydrationNode(targetNode.nextSibling)
        }

        // if the HTML corresponding to Teleport is not embedded in the
        // correct position on the final page during SSR. the targetAnchor will
        // always be null, we need to manually add targetAnchor to ensure
        // Teleport it can properly unmount or move
        if (!this.targetAnchor) {
          this.mountChildren(target)
        } else {
          this.initChildren()
        }
      }
    } else if (disabled) {
      this.hydrateDisabledTeleport(currentHydrationNode!)
    }

    advanceHydrationNode(this.anchor!)
  }
}

export function isVaporTeleport(
  value: unknown,
): value is typeof VaporTeleportImpl {
  return value === VaporTeleportImpl
}

function locateTeleportEndAnchor(
  node: Node = currentHydrationNode!,
): Node | null {
  while (node) {
    if (isComment(node, 'teleport end')) {
      return node
    }
    node = node.nextSibling as Node
  }
  return null
}

function updateCssVars(frag: TeleportFragment) {
  const ctx = frag.parentComponent as GenericComponentInstance
  if (ctx && ctx.ut) {
    let node, anchor
    if (frag.isDisabled) {
      node = frag.placeholder
      anchor = frag.anchor
    } else {
      node = frag.targetStart
      anchor = frag.targetAnchor
    }
    while (node && node !== anchor) {
      if (node.nodeType === 1)
        (node as Element).setAttribute('data-v-owner', String(ctx.uid))
      node = node.nextSibling
    }
    ctx.ut()
  }
}
