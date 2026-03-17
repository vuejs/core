import { pauseTracking, resetTracking } from '@vue/reactivity'
import {
  type GenericComponentInstance,
  MismatchTypes,
  MoveType,
  type SchedulerJob,
  SchedulerJobFlags,
  type TeleportProps,
  type TeleportTargetElement,
  isMismatchAllowed,
  isTeleportDeferred,
  isTeleportDisabled,
  queuePostFlushCb,
  resolveTeleportTarget,
  setCurrentInstance,
  warn,
} from '@vue/runtime-dom'
import {
  type Block,
  type BlockFn,
  applyTransitionHooks,
  insert,
  move,
  remove,
} from '../block'
import { createComment, createTextNode, querySelector } from '../dom/node'
import {
  type LooseRawProps,
  type LooseRawSlots,
  type VaporComponentInstance,
  currentInstance,
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
import type { DefineVaporSetupFnComponent } from '../apiDefineComponent'
import { getScopeOwner } from '../componentSlots'

const VaporTeleportImpl = {
  name: 'VaporTeleport',
  __isTeleport: true,
  __vapor: true,

  process(props: LooseRawProps, slots: LooseRawSlots): TeleportFragment {
    return new TeleportFragment(props, slots)
  },
}

export class TeleportFragment extends VaporFragment {
  /**
   * @internal marker for duck typing to avoid direct instanceof check
   * which prevents tree-shaking of TeleportFragment
   */
  readonly __isTeleportFragment = true
  anchor?: Node
  private rawProps?: LooseRawProps
  private resolvedProps?: TeleportProps
  private rawSlots?: LooseRawSlots
  isDisabled?: boolean
  private isMounted = false
  private childrenInitialized = false
  private readonly ownerInstance =
    currentInstance as VaporComponentInstance | null

  target?: ParentNode | null
  targetAnchor?: Node | null
  targetStart?: Node | null

  placeholder?: Node
  mountContainer?: ParentNode | null
  mountAnchor?: Node | null

  private mountToTargetJob?: SchedulerJob

  constructor(props: LooseRawProps, slots: LooseRawSlots) {
    super([])
    this.rawProps = props
    this.rawSlots = slots
    this.parentComponent = getScopeOwner()
    this.anchor = isHydrating
      ? undefined
      : __DEV__
        ? createComment('teleport end')
        : createTextNode()

    renderEffect(() => {
      const prevTo = this.resolvedProps && this.resolvedProps.to
      const wasDisabled = this.isDisabled
      // access the props to trigger tracking
      this.resolvedProps = extend(
        {},
        new Proxy(
          this.rawProps!,
          rawPropsProxyHandlers,
        ) as any as TeleportProps,
      )

      this.isDisabled = isTeleportDisabled(this.resolvedProps!)
      if (
        wasDisabled !== this.isDisabled ||
        (!this.isDisabled && prevTo !== this.resolvedProps.to)
      ) {
        this.handlePropsUpdate()
      }
    })
  }

  get parent(): ParentNode | null {
    return this.anchor ? this.anchor.parentNode : null
  }

  private initChildren(): void {
    const prevInstance = setCurrentInstance(this.ownerInstance)
    try {
      this.childrenInitialized = true
      renderEffect(() =>
        this.runWithRenderCtx(() =>
          this.handleChildrenUpdate(
            this.rawSlots!.default && (this.rawSlots!.default as BlockFn)(),
          ),
        ),
      )
      this.bindChildren(this.nodes)
    } finally {
      setCurrentInstance(...prevInstance)
    }
  }

  private ensureChildrenInitialized(): void {
    if (!this.childrenInitialized) {
      this.initChildren()
    }
  }

  private registerUpdateCssVars(block: Block) {
    if (isFragment(block)) {
      ;(block.onUpdated || (block.onUpdated = [])).push(() =>
        updateCssVars(this),
      )
      this.registerUpdateCssVars(block.nodes)
    } else if (isVaporComponent(block)) {
      this.registerUpdateCssVars(block.block)
    } else if (isArray(block)) {
      block.forEach(node => this.registerUpdateCssVars(node))
    }
  }

  private bindChildren(block: Block): void {
    // register updateCssVars to nested fragments's update hooks so that
    // it will be called when root fragment changed
    if (this.parentComponent && this.parentComponent.ut) {
      this.registerUpdateCssVars(block)
    }

    if (__DEV__) {
      if (isVaporComponent(block)) {
        block.parentTeleport = this
      } else if (isArray(block)) {
        block.forEach(
          node => isVaporComponent(node) && (node.parentTeleport = this),
        )
      }
    }
  }

  private handleChildrenUpdate(children: Block): void {
    if (isHydrating || !this.parent || !this.mountContainer) {
      this.nodes = children
      return
    }

    // teardown previous nodes
    remove(this.nodes, this.mountContainer!)
    // mount new nodes
    insert((this.nodes = children), this.mountContainer!, this.mountAnchor!)
    this.bindChildren(this.nodes)
    updateCssVars(this)
  }

  private mount(parent: ParentNode, anchor: Node | null) {
    // don't apply transitions during move teleports
    // algin with Vue DOM teleport behavior
    if (this.$transition && !this.isMounted) {
      applyTransitionHooks(this.nodes, this.$transition)
    }
    if (this.isMounted) {
      move(
        this.nodes,
        (this.mountContainer = parent),
        (this.mountAnchor = anchor),
        MoveType.REORDER,
      )
    } else {
      insert(
        this.nodes,
        (this.mountContainer = parent),
        (this.mountAnchor = anchor),
      )
      this.isMounted = true
    }
    updateCssVars(this)
  }

  private mountToTarget(): void {
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
        // clean up old anchors from previous target when target changes
        if (this.targetStart) {
          remove(this.targetStart, this.targetStart.parentNode!)
        }
        if (this.targetAnchor) {
          remove(this.targetAnchor, this.targetAnchor.parentNode!)
        }
        insert((this.targetStart = createTextNode('')), target)
        insert((this.targetAnchor = createTextNode('')), target)
      }

      this.ensureChildrenInitialized()

      // track CE teleport targets
      if (this.parentComponent && this.parentComponent.isCE) {
        ;(
          this.parentComponent.ce!._teleportTargets ||
          (this.parentComponent.ce!._teleportTargets = new Set())
        ).add(target)
      }

      this.mount(target, this.targetAnchor!)
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
      this.ensureChildrenInitialized()
      this.mount(this.parent, this.anchor!)
    }
    // mount into target container
    else {
      if (
        isTeleportDeferred(this.resolvedProps!) ||
        // force defer when the parent is not connected to the DOM,
        // typically due to an early insertion caused by setInsertionState.
        !this.parent!.isConnected
      ) {
        // Reuse one queued mount job per Teleport instance so repeated
        // updates in the same flush don't enqueue duplicate target mounts.
        // If the previous job was disposed during unmount, recreate it.
        if (
          !this.mountToTargetJob ||
          this.mountToTargetJob.flags! & SchedulerJobFlags.DISPOSED
        ) {
          this.mountToTargetJob = () => {
            this.mountToTargetJob = undefined
            // State may have changed before the post-flush job runs.
            if (this.isDisabled || !this.anchor) return
            this.mountToTarget()
          }
        }
        queuePostFlushCb(this.mountToTargetJob)
      } else {
        this.mountToTarget()
      }
    }
  }

  insert = (container: ParentNode, anchor: Node | null): void => {
    if (isHydrating) return

    // Re-inserting an already-mounted teleport should move existing anchors
    // instead of creating a second placeholder in the main view.
    if (!this.placeholder) {
      this.placeholder = __DEV__
        ? createComment('teleport start')
        : createTextNode()
    }

    insert(this.placeholder, container, anchor)
    insert(this.anchor!, container, anchor)
    this.handlePropsUpdate()
  }

  remove = (parent: ParentNode | undefined = this.parent!): void => {
    if (this.mountToTargetJob) {
      this.mountToTargetJob.flags! |= SchedulerJobFlags.DISPOSED
      this.mountToTargetJob = undefined
    }

    // remove nodes
    if (this.nodes && this.mountContainer) {
      remove(this.nodes, this.mountContainer)
      this.nodes = []
    }

    this.isMounted = false

    // remove anchors
    if (this.targetStart) {
      remove(this.targetStart, this.target!)
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

  private hydrateTargetAnchors(
    target: TeleportTargetElement,
    targetNode: Node | null,
  ): void {
    let targetAnchor = targetNode
    while (targetAnchor) {
      if (targetAnchor.nodeType === 8) {
        if ((targetAnchor as Comment).data === 'teleport start anchor') {
          this.targetStart = targetAnchor
        } else if ((targetAnchor as Comment).data === 'teleport anchor') {
          this.targetAnchor = targetAnchor
          target._lpa = this.targetAnchor.nextSibling
          break
        }
      }
      targetAnchor = targetAnchor.nextSibling
    }
  }

  private hydrateDisabledTeleport(
    target: TeleportTargetElement | null,
    targetNode: Node | null,
  ): void {
    if (!isHydrating) return
    let nextNode = this.placeholder!.nextSibling!
    setCurrentHydrationNode(nextNode)
    this.mountAnchor = this.anchor = locateTeleportEndAnchor(nextNode)!
    this.mountContainer = this.anchor.parentNode
    if (target) {
      this.hydrateTargetAnchors(target, targetNode)
    } else {
      this.targetStart = targetNode
      this.targetAnchor = targetNode && targetNode.nextSibling
    }
    this.initChildren()
  }

  private mountChildren(target: Node): void {
    if (!isHydrating) return
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
    if (!isHydrating) return
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
        this.hydrateDisabledTeleport(
          target as TeleportTargetElement,
          targetNode,
        )
      } else {
        this.anchor = locateTeleportEndAnchor(
          currentHydrationNode!.nextSibling!,
        )!
        this.mountContainer = target
        this.hydrateTargetAnchors(target as TeleportTargetElement, targetNode)
        this.mountAnchor = this.targetAnchor

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
      // pass null as targetNode since there is no target
      this.hydrateDisabledTeleport(null, null)
    } else {
      // Align with VDOM Teleport hydration: keep main-view markers only and
      // avoid mounting children inline or eagerly initializing them when the
      // target is missing.
      this.anchor = locateTeleportEndAnchor(currentHydrationNode!.nextSibling!)!
    }

    if (target || disabled) {
      updateCssVars(this)
    }
    advanceHydrationNode(this.anchor!)
  }
}

export const VaporTeleport =
  VaporTeleportImpl as unknown as DefineVaporSetupFnComponent<TeleportProps>

/**
 * Use duck typing to check for VaporTeleport instead of direct reference
 * to VaporTeleportImpl, allowing tree-shaking when Teleport is not used.
 */
export function isVaporTeleport(
  value: unknown,
): value is typeof VaporTeleportImpl {
  return !!(value && (value as any).__isTeleport && (value as any).__vapor)
}

/**
 * Use duck typing to check for TeleportFragment instead of instanceof,
 * allowing tree-shaking when Teleport is not used.
 */
export function isTeleportFragment(value: unknown): value is TeleportFragment {
  return !!(value && (value as any).__isTeleportFragment)
}

function locateTeleportEndAnchor(
  node: Node = currentHydrationNode!,
): Node | null {
  let depth = 0
  while (node) {
    if (isComment(node, 'teleport start')) {
      depth++
    } else if (isComment(node, 'teleport end')) {
      if (depth === 0) {
        return node
      } else {
        depth--
      }
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
    // Avoid collecting the owner's css vars dependencies into the active
    // Teleport effect, or later css vars updates would re-run Teleport itself.
    pauseTracking()
    try {
      ctx.ut()
    } finally {
      resetTracking()
    }
  }
}
