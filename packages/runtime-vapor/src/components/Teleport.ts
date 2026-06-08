import { getCurrentScope, pauseTracking, resetTracking } from '@vue/reactivity'
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
import { type Block, type BlockFn, insert, move, remove } from '../block'
import {
  createComment,
  createTextNode,
  parentNode,
  querySelector,
} from '../dom/node'
import {
  type LooseRawProps,
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
  markHydrationAnchor,
  runWithoutHydration,
  setCurrentHydrationNode,
} from '../dom/hydration'
import type { DefineVaporSetupFnComponent } from '../apiDefineComponent'
import { type RawSlots, getScopeOwner } from '../componentSlots'
import { applyTransitionHooks, isTransitionEnabled } from '../transition'
import { enableTeleport } from '../teleport'

const VaporTeleportImpl = {
  name: 'VaporTeleport',
  __isTeleport: true,
  __vapor: true,

  process(props: LooseRawProps, slots?: RawSlots | null): TeleportFragment {
    return new TeleportFragment(props, slots)
  },
}

const enum TeleportMountLocation {
  None,
  Main,
  Target,
}

type TeleportMountState =
  | {
      location: TeleportMountLocation.None
    }
  | {
      location: TeleportMountLocation.Main | TeleportMountLocation.Target
      container: ParentNode
      anchor: Node | null
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
  private rawSlots?: RawSlots | null
  isDisabled?: boolean
  private childrenInitialized = false
  private readonly ownerInstance =
    currentInstance as VaporComponentInstance | null
  private readonly childrenScope = getCurrentScope()

  target?: ParentNode | null
  targetAnchor?: Node | null
  targetStart?: Node | null

  placeholder?: Node
  private mountState: TeleportMountState = {
    location: TeleportMountLocation.None,
  }

  private mountToTargetJob?: SchedulerJob

  constructor(props: LooseRawProps, slots?: RawSlots | null) {
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
    return this.anchor ? parentNode(this.anchor) : null
  }

  private initChildren(): void {
    const prevInstance = setCurrentInstance(
      this.ownerInstance,
      this.childrenScope,
    )
    try {
      this.childrenInitialized = true
      renderEffect(() =>
        this.runWithRenderCtx(
          () =>
            this.handleChildrenUpdate(
              this.rawSlots && this.rawSlots.default
                ? (this.rawSlots.default as BlockFn)()
                : [],
            ),
          this.childrenScope,
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
  }

  private handleChildrenUpdate(children: Block): void {
    const mountState = this.mountState
    if (
      isHydrating ||
      !this.parent ||
      mountState.location === TeleportMountLocation.None
    ) {
      this.nodes = children
      return
    }

    // teardown previous nodes
    remove(this.nodes, mountState.container)
    // mount new nodes
    this.nodes = children
    const onBeforeInsert = this.onBeforeInsert
    if (onBeforeInsert) onBeforeInsert.forEach(fn => fn(this.nodes))
    insert(children, mountState.container, mountState.anchor)
    this.bindChildren(this.nodes)
    updateCssVars(this)
  }

  private mount(
    parent: ParentNode,
    anchor: Node | null,
    location: TeleportMountLocation.Main | TeleportMountLocation.Target,
  ) {
    // don't apply transitions during move teleports
    // algin with Vue DOM teleport behavior
    if (
      isTransitionEnabled &&
      this.$transition &&
      this.mountState.location === TeleportMountLocation.None
    ) {
      applyTransitionHooks(this.nodes, this.$transition)
    }
    if (this.mountState.location !== TeleportMountLocation.None) {
      move(this.nodes, parent, anchor, MoveType.REORDER)
    } else {
      const onBeforeInsert = this.onBeforeInsert
      if (onBeforeInsert) onBeforeInsert.forEach(fn => fn(this.nodes))
      insert(this.nodes, parent, anchor)
    }
    this.mountState = { location, container: parent, anchor }
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
        parentNode(this.targetAnchor) !== target
      ) {
        // clean up old anchors from previous target when target changes
        if (this.targetStart) {
          remove(this.targetStart, parentNode(this.targetStart)!)
        }
        if (this.targetAnchor) {
          remove(this.targetAnchor, parentNode(this.targetAnchor)!)
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

      this.mount(target, this.targetAnchor!, TeleportMountLocation.Target)
    } else {
      if (__DEV__) {
        warn(
          `Invalid Teleport target on ${this.targetAnchor ? 'update' : 'mount'}:`,
          target,
          `(${typeof target})`,
        )
      }
    }
  }

  private handlePropsUpdate(): void {
    // not mounted yet
    if (!this.parent || isHydrating) return

    // mount into main container
    if (this.isDisabled) {
      this.ensureChildrenInitialized()
      this.mount(this.parent, this.anchor!, TeleportMountLocation.Main)
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

  dispose = (): void => {
    if (this.mountToTargetJob) {
      this.mountToTargetJob.flags! |= SchedulerJobFlags.DISPOSED
      this.mountToTargetJob = undefined
    }

    // remove nodes
    const mountState = this.mountState
    if (this.nodes && mountState.location !== TeleportMountLocation.None) {
      remove(this.nodes, mountState.container)
      this.nodes = []
    }

    this.mountState = { location: TeleportMountLocation.None }

    // remove anchors
    if (this.targetStart) {
      remove(this.targetStart, parentNode(this.targetStart)!)
      this.targetStart = undefined
    }
    if (this.targetAnchor) {
      remove(this.targetAnchor, parentNode(this.targetAnchor)!)
      this.targetAnchor = undefined
    }

    this.target = undefined
  }

  remove = (_parent?: ParentNode): void => {
    this.dispose()

    if (this.anchor) {
      remove(this.anchor, parentNode(this.anchor)!)
      this.anchor = undefined
    }

    if (this.placeholder) {
      remove(this.placeholder!, parentNode(this.placeholder) as ParentNode)
      this.placeholder = undefined
    }
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
          this.targetAnchor = markHydrationAnchor(targetAnchor)
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
    this.anchor = markHydrationAnchor(locateTeleportEndAnchor(nextNode)!)
    this.mountState = {
      location: TeleportMountLocation.Main,
      container: parentNode(this.anchor)!,
      anchor: this.anchor,
    }
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
      (this.targetAnchor = markHydrationAnchor(createTextNode(''))),
    )
    this.mountState = {
      location: TeleportMountLocation.Target,
      container: target as ParentNode,
      anchor: this.targetAnchor,
    }

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
        this.anchor = markHydrationAnchor(
          locateTeleportEndAnchor(currentHydrationNode!.nextSibling!)!,
        )
        this.hydrateTargetAnchors(target as TeleportTargetElement, targetNode)
        this.mountState = {
          location: TeleportMountLocation.Target,
          container: target,
          anchor: this.targetAnchor || null,
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
      // pass null as targetNode since there is no target
      this.hydrateDisabledTeleport(null, null)
    } else {
      // Align with VDOM Teleport hydration: keep main-view markers only and
      // avoid mounting children inline or eagerly initializing them when the
      // target is missing.
      this.anchor = markHydrationAnchor(
        locateTeleportEndAnchor(currentHydrationNode!.nextSibling!)!,
      )
    }

    if (target || disabled) {
      updateCssVars(this)
    }
    advanceHydrationNode(this.anchor!)
  }
}

export const VaporTeleport: DefineVaporSetupFnComponent<TeleportProps> =
  /*@__PURE__*/ enableTeleport(
    VaporTeleportImpl as unknown as DefineVaporSetupFnComponent<TeleportProps>,
  )

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
