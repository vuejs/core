import {
  type AsyncComponentInternalOptions,
  type ComponentCustomElementInterface,
  type ComponentInternalInstance,
  type ComponentInternalOptions,
  type ComponentObjectPropsOptions,
  type ComponentPropsOptions,
  EffectScope,
  type EmitFn,
  type EmitsOptions,
  type EmitsToProps,
  ErrorCodes,
  type ExtractPropTypes,
  type GenericAppContext,
  type GenericComponentInstance,
  type LifecycleHook,
  NULL_DYNAMIC_COMPONENT,
  type NormalizedPropsOptions,
  type ObjectEmitsOptions,
  type SchedulerJob,
  SchedulerJobFlags,
  type ShallowUnwrapRef,
  type SuspenseBoundary,
  callWithErrorHandling,
  currentInstance,
  endMeasure,
  expose,
  filterModelListeners,
  getComponentName,
  getFunctionalFallthrough,
  invalidateMount,
  isAsyncWrapper,
  isKeepAlive,
  markAsyncBoundary,
  nextUid,
  popWarningContext,
  pushWarningContext,
  queuePostRenderEffect,
  registerHMR,
  resolveComponent,
  restoreCurrentInstance,
  setCurrentInstance,
  setCurrentRenderingInstance,
  startMeasure,
  unregisterHMR,
  warn,
  warnExtraneousAttributes,
} from '@vue/runtime-dom'
import { type Block, findBlockBoundary, insert, isBlock, remove } from './block'
import {
  type ShallowRef,
  markRaw,
  onScopeDispose,
  proxyRefs,
  setActiveSub,
  toRaw,
  unref,
} from '@vue/reactivity'
import {
  EMPTY_OBJ,
  NOOP,
  type Prettify,
  ShapeFlags,
  hasOwn,
  invokeArrayFns,
  isArray,
  isFunction,
  isModelListener,
  isPromise,
  isString,
} from '@vue/shared'
import {
  type DynamicPropsSource,
  type RawProps,
  getKeysFromRawProps,
  getPropsProxyHandlers,
  hasFallthroughAttrs,
  normalizePropsOptions,
  resolveDynamicProps,
  setupPropsValidation,
  snapshotRawProps,
} from './componentProps'
import { renderEffect } from './renderEffect'
import { emit, normalizeEmitsOptions } from './componentEmits'
import { setDynamicProps } from './dom/prop'
import {
  type LooseRawSlots,
  type RawSlots,
  type StaticSlots,
  dynamicSlotsProxyHandlers,
  getSlot,
  inOnceSlot,
  normalizeRawSlots,
  setCurrentSlotOwner,
  withOnceSlot,
} from './componentSlots'
import { hmrReload, hmrRerender } from './hmr'
import {
  type FragmentClaim,
  type HydrationCursor,
  adoptTemplate,
  advanceHydrationNode,
  claimAnchor,
  createFragmentClaim,
  currentHydrationNode,
  enterHydrationBoundary,
  enterHydrationCursor,
  exitHydrationCursor,
  isComment,
  isHydrating,
  isRecreatedNode,
  locateEndAnchor,
  nextLogicalSibling,
  setCurrentHydrationNode,
  withDeferredHydrationBoundary,
} from './dom/hydration'
import { createComment, createElement, createTextNode } from './dom/node'
import {
  isTeleportEnabled,
  isTeleportFragment,
  isVaporTeleport,
} from './teleport'
import type { KeepAliveInstance } from './components/KeepAlive'
import {
  type VaporKeepAliveContext,
  getKeepAliveContext,
  isKeepAliveEnabled,
} from './keepAlive'
import { isAsyncComponentEnabled } from './asyncComponentState'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import type {
  DefineVaporComponent,
  VaporRenderResult,
} from './apiDefineComponent'
import {
  DynamicFragment,
  type InteropFragment,
  finishBlockCreation,
  isDynamicFragment,
  isFragment,
  isInteropFragment,
  isSlotOutletFragment,
} from './fragment'
import { NATIVE_CHILDREN, SLOT } from './fragmentFlags'
import { resolvePendingSlotContent } from './dom/hydrateFragment'
import type { VaporElement } from './apiDefineCustomElement'
import {
  currentUnmountSuspense,
  isSuspenseEnabled,
  parentSuspense,
  resolveUnmountSuspense,
  runWithUnmountSuspense,
  setParentSuspense,
} from './suspense'
import { isInteropEnabled } from './vdomInteropState'
import {
  applyComponentScopeIds,
  currentSlotScopeIds,
  getCurrentScopeId,
  hydrateComponentScopeIds,
  setCurrentSlotScopeIds,
  setElementScopeIds,
} from './scopeId'
import { isTransitionEnabled, isVaporTransition } from './transition'

export { currentInstance } from '@vue/runtime-dom'

export type VaporComponent =
  | FunctionalVaporComponent<any>
  | VaporComponentOptions
  | DefineVaporComponent

export type FunctionalVaporComponent<
  Props = {},
  Emits extends EmitsOptions = {},
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
> = ((
  props: Props & EmitsToProps<Emits>,
  ctx: {
    emit: EmitFn<Emits>
    slots: Slots
    attrs: Record<string, any>
    expose: (exposed: Exposed) => void
  },
) => VaporRenderResult) &
  Omit<
    VaporComponentOptions<ComponentPropsOptions<Props>, Emits, string, Slots>,
    'setup'
  > & {
    displayName?: string
  } & SharedInternalOptions

export interface VaporComponentOptions<
  Props = {},
  Emits extends EmitsOptions = {},
  RuntimeEmitsKeys extends string = string,
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
  TypeBlock extends Block = Block,
  InferredProps = ComponentObjectPropsOptions extends Props
    ? {}
    : ExtractPropTypes<Props>,
>
  extends
    ComponentInternalOptions,
    AsyncComponentInternalOptions<
      VaporComponentOptions,
      VaporComponentInstance
    >,
    SharedInternalOptions {
  inheritAttrs?: boolean
  props?: Props
  emits?: Emits | RuntimeEmitsKeys[]
  slots?: Slots
  setup?: (
    props: Readonly<InferredProps>,
    ctx: {
      emit: EmitFn<Emits>
      slots: Slots
      attrs: Record<string, any>
      expose: (exposed: Exposed) => void
    },
  ) => VaporRenderResult<TypeBlock> | Exposed | Promise<Exposed> | void
  render?(
    ctx: Exposed extends VaporRenderResult
      ? Record<string, any>
      : ShallowUnwrapRef<Exposed>,
    props: Readonly<InferredProps>,
    emit: EmitFn<Emits>,
    attrs: any,
    slots: Slots,
  ): VaporRenderResult<TypeBlock> | void

  name?: string
  vapor?: boolean
  components?: Record<string, VaporComponent>
}

interface SharedInternalOptions {
  /**
   * Cached normalized props options.
   * In vapor mode there are no mixins so normalized options can be cached
   * directly on the component
   */
  __propsOptions?: NormalizedPropsOptions
  /**
   * Cached normalized props proxy handlers.
   */
  __propsHandlers?: [ProxyHandler<any> | null, ProxyHandler<any>]
  /**
   * Cached normalized emits options.
   */
  __emitsOptions?: ObjectEmitsOptions
}

// In TypeScript, it is actually impossible to have a record type with only
// specific properties that have a different type from the indexed type.
// This makes our rawProps / rawSlots shape difficult to satisfy when calling
// `createComponent` - luckily this is not user-facing, so we use intentionally
// wider types to make `createComponent` ergonomic in tests and internal call sites.
export type LooseRawProps = Record<string, unknown> & {
  $?: DynamicPropsSource[]
}

// Not an explicit vapor component: mounted through vdom interop.
function useVdomInterop(
  component: VaporComponent,
  appContext: GenericAppContext,
): boolean {
  return isInteropEnabled && !!appContext.vdom && !component.__vapor
}

export function createComponent(
  component: VaporComponent,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
  appContext: GenericAppContext = (currentInstance &&
    currentInstance.appContext) ||
    emptyContext,
  managedMount = false,
  ce?: (instance: VaporComponentInstance) => void,
): VaporComponentInstance {
  // A component created while rendering a v-once slot should receive frozen
  // parent inputs, but its own render effects should still be live.
  const wasInOnceSlot = inOnceSlot
  if (wasInOnceSlot) once = true

  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  let hydrationClose: Node | null = null
  let hydrationClaim: FragmentClaim | undefined
  let hydrationCursor: HydrationCursor | null = null
  let exitHydrationBoundary: (() => void) | undefined
  let deferHydrationBoundary = false
  const finalizeHydrationBoundary = () => {
    exitHydrationBoundary && exitHydrationBoundary()
    if (hydrationClose && currentHydrationNode === hydrationClose) {
      advanceHydrationNode(hydrationClose)
    }
  }
  if (isHydrating) {
    resolvePendingSlotContent()
    if (component.__multiRoot) hydrationClaim = createFragmentClaim()
    hydrationCursor = enterHydrationCursor(hydrationClaim, true)
    if (hydrationClaim && hydrationClaim.start) {
      hydrationClose = locateEndAnchor(hydrationClaim.start)
      exitHydrationBoundary = enterHydrationBoundary(
        hydrationClose && claimAnchor(hydrationClose),
      )
    }
  } else {
    resetInsertionState()
  }

  let prevSuspense: SuspenseBoundary | null = null
  let hasParentSuspense = false
  try {
    if (
      __FEATURE_SUSPENSE__ &&
      isSuspenseEnabled &&
      currentInstance &&
      currentInstance.suspense
    ) {
      prevSuspense = setParentSuspense(currentInstance.suspense)
      hasParentSuspense = true
    }

    if (
      (isSingleRoot ||
        // transition has attrs fallthrough
        (isTransitionEnabled
          ? currentInstance && isVaporTransition(currentInstance!.type)
          : false)) &&
      isVaporComponent(currentInstance) &&
      currentInstance.type.inheritAttrs !== false &&
      currentInstance.hasFallthrough
    ) {
      // check if we are the single root of the parent
      // if yes, inject parent attrs as dynamic props source.
      // capture the owner: dynamic sources can be resolved from read paths
      // that do not restore the parent as currentInstance.
      const owner = currentInstance
      const source = () => resolveFallthroughAttrs(owner)
      if (rawProps && rawProps !== EMPTY_OBJ) {
        ;((rawProps as RawProps).$ || ((rawProps as RawProps).$ = [])).push(
          source,
        )
      } else {
        rawProps = { $: [source] } as RawProps
      }
    }

    let keepAliveCtx: VaporKeepAliveContext | null = null
    // keep-alive
    if (
      isKeepAliveEnabled &&
      currentInstance &&
      currentInstance.vapor &&
      isKeepAlive(currentInstance)
    ) {
      const ctx = (currentInstance as KeepAliveInstance).ctx
      keepAliveCtx = ctx
      const cached = ctx.getCachedComponent(component)
      // @ts-expect-error
      if (cached) return cached
    }

    // A resolved async component is created as its resolved component: with
    // no diffing there is nothing for a wrapper to be the stable identity of.
    // Hydration keeps the wrapper so the lazy path owns the adopted DOM, and
    // so does an inner mounted through vdom interop, whose useId boundary is
    // the wrapper.
    let asyncBoundary = false
    if (isAsyncComponentEnabled && !isHydrating) {
      const resolved = component.__asyncResolved
      if (resolved && !useVdomInterop(resolved, appContext)) {
        component = resolved
        asyncBoundary = true
      }
    }

    if (useVdomInterop(component, appContext)) {
      const frag = appContext.vdom!.mount(
        component as any,
        currentInstance as any,
        rawProps,
        normalizeRawSlots(rawSlots),
        once,
      )
      if (!isHydrating) {
        if (_insertionParent) {
          insert(frag, _insertionParent, _insertionAnchor, parentSuspense)
        }
      } else {
        frag.hydrate()
      }
      return frag
    }

    // teleport
    if (isTeleportEnabled && isVaporTeleport(component)) {
      // the teleport's main-view end anchor adopts the template `<!>`
      // placeholder when anchored via insertion state
      const frag = component.process(
        rawProps!,
        normalizeRawSlots(rawSlots),
        _insertionAnchor,
      )
      if (_insertionParent) {
        // Teleports mounted via insertion state are not part of the returned
        // block tree, so scope disposal must tear down their target-side state.
        onScopeDispose(() => frag.disposeTarget(), true)
      } else {
        // Give normal block removal (and Transition leave preparation) the
        // current stack before falling back to target-side cleanup.
        onScopeDispose(() => frag.scheduleTargetDispose(), true)
      }
      if (!isHydrating) {
        if (_insertionParent) {
          insert(frag, _insertionParent, _insertionAnchor, parentSuspense)
        }
      } else {
        frag.hydrate()
      }

      return frag as any
    }

    let inputScope: EffectScope | undefined
    if (
      keepAliveCtx &&
      ((rawProps && !once) || (rawSlots && (rawSlots as RawSlots).$))
    ) {
      // The cached component keeps its detached scope active, so commit only
      // its direct inputs through a cache-owned scope. Descendants read from
      // the same committed inputs and need no additional isolation.
      // v-once snapshots raw props in the instance constructor, so it does not
      // need a live commit effect after creation.
      const scope = new EffectScope(true)
      let isolated = false
      scope.run(() => {
        if (rawProps && !once) {
          const next = keepAliveCtx!.isolatePropSources(rawProps as RawProps)
          isolated = next !== rawProps
          rawProps = next
        }

        // Static slots are fixed function entries. Only `$` contains live slot
        // descriptor sources that useSlots() can re-resolve while cached; slot
        // function execution retains its existing closure semantics.
        if (rawSlots && (rawSlots as RawSlots).$) {
          const next = keepAliveCtx!.isolateSlotSources(rawSlots as RawSlots)
          isolated = isolated || next !== rawSlots
          rawSlots = next
        }
      })
      if (isolated) {
        inputScope = scope
      }
    }

    const instance = new VaporComponentInstance(
      component,
      rawProps as RawProps,
      rawSlots,
      appContext,
      once,
      ce,
    )
    if (inputScope) {
      instance.inputScope = inputScope
    }
    if (asyncBoundary) markAsyncBoundary(instance)

    // Async wrappers are skipped here: their DynamicFragment resolves the outer
    // KeepAlive context from the wrapper's parent chain during setup.
    if (
      isKeepAliveEnabled &&
      !(isAsyncComponentEnabled && isAsyncWrapper(instance))
    ) {
      keepAliveCtx ||= getKeepAliveContext(currentInstance)
      if (keepAliveCtx) keepAliveCtx.processShapeFlag(instance)
    }

    // reset currentSlotOwner to null to avoid affecting the child components
    const prevSlotOwner = setCurrentSlotOwner(null)
    // Slot scope ids stop at component boundaries; the instance captured
    // them above for root-only application.
    const prevSlotScopeIds = setCurrentSlotScopeIds(null)
    let hasWarningContext = false
    let hasInitMeasure = false
    try {
      // HMR
      if (__DEV__) {
        registerHMR(instance)
        instance.isSingleRoot = isSingleRoot
        instance.hmrRerender = hmrRerender.bind(null, instance)
        instance.hmrReload = hmrReload.bind(null, instance)

        pushWarningContext(instance)
        hasWarningContext = true
        startMeasure(instance, `init`)
        hasInitMeasure = true

        // cache normalized options for dev only emit check
        instance.propsOptions = normalizePropsOptions(component)
        instance.emitsOptions = normalizeEmitsOptions(component)
      }

      // hydrating async component
      if (
        isHydrating &&
        isAsyncComponentEnabled &&
        isAsyncWrapper(instance) &&
        component.__asyncHydrate
      ) {
        const setup = () => setupComponent(instance, component)
        component.__asyncHydrate(
          currentHydrationNode as Element,
          instance,
          // Async hydration re-enters setup later, so preserve the component
          // boundary rule above when the delayed setup actually runs.
          wasInOnceSlot ? () => withOnceSlot(setup, false) : setup,
        )
      } else {
        if (wasInOnceSlot) {
          withOnceSlot(() => setupComponent(instance, component), false)
        } else {
          setupComponent(instance, component)
        }

        if (
          isHydrating &&
          __FEATURE_SUSPENSE__ &&
          isSuspenseEnabled &&
          instance.suspense &&
          instance.asyncDep
        ) {
          // Async setup cannot create `block` yet. Capture the adopted SSR
          // range for pending move/removal before hydration advances past it.
          const pendingBlock: Node[] = []
          let node: Node =
            (hydrationClaim && hydrationClaim.start) || hydrationCursor!.start!
          const hydrationNext = nextLogicalSibling(node)
          do {
            pendingBlock.push(node)
            node = node.nextSibling!
          } while (node !== hydrationNext)
          instance.pendingBlock =
            pendingBlock.length === 1 ? pendingBlock[0] : pendingBlock
          advanceHydrationNode(pendingBlock[pendingBlock.length - 1])
        }
      }
    } finally {
      if (__DEV__) {
        if (hasWarningContext) {
          popWarningContext()
        }
        if (hasInitMeasure) {
          endMeasure(instance, 'init')
        }
      }
      setCurrentSlotScopeIds(prevSlotScopeIds)
      setCurrentSlotOwner(prevSlotOwner)
      if (__FEATURE_SUSPENSE__ && isSuspenseEnabled && hasParentSuspense) {
        setParentSuspense(prevSuspense)
        hasParentSuspense = false
      }
    }
    onScopeDispose(
      () =>
        unmountComponent(
          instance,
          undefined,
          __FEATURE_SUSPENSE__ && isInteropEnabled
            ? resolveUnmountSuspense(instance.suspense)
            : instance.suspense,
        ),
      true,
    )

    if (!managedMount && (_insertionParent || isHydrating)) {
      mountComponent(instance, _insertionParent!, _insertionAnchor)
    }

    if (
      __FEATURE_SUSPENSE__ &&
      isSuspenseEnabled &&
      isHydrating &&
      hydrationClose &&
      instance.suspense &&
      instance.asyncDep &&
      !instance.asyncResolved &&
      instance.restoreAsyncContext
    ) {
      deferHydrationBoundary = true
      instance.deferredHydrationBoundary = () => {
        if (
          instance.block &&
          hydrationClose &&
          findBlockBoundary(instance.block).nextNode ===
            hydrationClose.nextSibling
        ) {
          setCurrentHydrationNode(hydrationClose)
        }
        finalizeHydrationBoundary()
      }
      exitHydrationCursor(hydrationCursor)
    }

    return instance
  } finally {
    if (hasParentSuspense) {
      setParentSuspense(prevSuspense)
    }
    if (isHydrating && !deferHydrationBoundary) {
      // Boundary cleanup still needs the component-local cursor. Only after
      // that do we restore the outer cursor's resume point.
      finalizeHydrationBoundary()
      exitHydrationCursor(hydrationCursor)
    }
  }
}

export function setupComponent(
  instance: VaporComponentInstance,
  component: VaporComponent,
): void {
  const prevInstance = setCurrentInstance(instance)
  const prevSub = setActiveSub()

  if (__DEV__) {
    setupPropsValidation(instance)
  }

  const setupFn = isFunction(component) ? component : component.setup
  const setupResult = setupFn
    ? callWithErrorHandling(setupFn, instance, ErrorCodes.SETUP_FUNCTION, [
        instance.props,
        instance,
      ]) || EMPTY_OBJ
    : EMPTY_OBJ

  const isAsyncSetup = isPromise(setupResult)

  if (
    (isAsyncSetup || instance.sp) &&
    !(isAsyncComponentEnabled && isAsyncWrapper(instance))
  ) {
    // async setup / serverPrefetch, mark as async boundary for useId()
    markAsyncBoundary(instance)
  }

  if (isAsyncSetup) {
    if (__FEATURE_SUSPENSE__) {
      // async setup returned Promise.
      // bail here and wait for re-entry.
      instance.asyncDep = setupResult
      if (__DEV__ && !instance.suspense) {
        const name = getComponentName(component) ?? 'Anonymous'
        warn(
          `Component <${name}>: setup function returned a promise, but no ` +
            `<Suspense> boundary was found in the parent component tree. ` +
            `A component with async setup() must be nested in a <Suspense> ` +
            `in order to be rendered.`,
        )
      }
    } else if (__DEV__) {
      warn(
        `setup() returned a Promise, but the version of Vue you are using ` +
          `does not support it yet.`,
      )
    }
  } else {
    handleSetupResult(setupResult, component, instance)
  }

  setActiveSub(prevSub)
  restoreCurrentInstance(prevInstance)
}

export let isApplyingFallthroughProps = false

export function shouldUseFunctionalFallthrough(
  component: VaporComponent,
): boolean {
  return (
    isFunction(component) &&
    // functional components that declare props receive full fallthrough,
    // matching vdom (`Component.props ? attrs : getFunctionalFallthrough`)
    !component.props &&
    !(isTransitionEnabled && isVaporTransition(component))
  )
}

/**
 * The single source of truth for the attrs a component may fall through to
 * its effective root — used both for the root element render effect and for
 * forwarding into a root component's props. Functional components without
 * declared props only pass class / style / event listeners; v-model
 * listeners with a corresponding declared prop never fall through (the
 * component handles the v-model itself — #1543, #1643, #1989). Never
 * returns undefined so consumers can always diff away stale keys.
 */
export function resolveFallthroughAttrs(
  instance: VaporComponentInstance,
): Record<string, any> {
  const attrs = shouldUseFunctionalFallthrough(instance.type)
    ? getFunctionalFallthrough(instance.attrs) || EMPTY_OBJ
    : instance.attrs
  const propsOptions = normalizePropsOptions(instance.type)[0]
  if (propsOptions) {
    for (const key in attrs) {
      if (isModelListener(key)) {
        return filterModelListeners(attrs, propsOptions)
      }
    }
  }
  return attrs
}

export function isDeclaredModelListener(
  instance: VaporComponentInstance,
  key: string,
): boolean {
  if (!isModelListener(key)) return false
  const propsOptions = normalizePropsOptions(instance.type)[0]
  return !!propsOptions && key.slice(9) in propsOptions
}

export function applyFallthroughProps(
  el: Element,
  attrs: Record<string, any>,
): void {
  isApplyingFallthroughProps = true
  try {
    setDynamicProps(el, [attrs])
  } finally {
    isApplyingFallthroughProps = false
  }
}

/**
 * dev only
 */
function createDevSetupStateProxy(
  setupState: Record<string, any>,
): Record<string, any> {
  return new Proxy(setupState, {
    get(target, key: string | symbol, receiver) {
      if (
        isString(key) &&
        !key.startsWith('__v') &&
        !hasOwn(toRaw(setupState), key)
      ) {
        warn(
          `Property ${JSON.stringify(key)} was accessed during render ` +
            `but is not defined on instance.`,
        )
      }

      return Reflect.get(target, key, receiver)
    },
  })
}

function callRender(
  render: NonNullable<VaporComponentOptions['render']>,
  instance: VaporComponentInstance,
  setupState: Record<string, any>,
) {
  return callWithErrorHandling(render, instance, ErrorCodes.RENDER_FUNCTION, [
    setupState,
    instance.props,
    instance.emit,
    instance.attrs,
    instance.slots,
  ])
}

/**
 * dev only
 * Runs devRender with everything it creates owned by a fresh per-render
 * scope, so HMR rerender can tear down one generation by stopping the
 * scope - including components nested inside elements, which the block
 * graph cannot reach.
 */
export function runDevRender(instance: VaporComponentInstance): void {
  // reset per-render dev state, preserving the optional-props marker
  // (attrs === props installs no tracking proxy)
  instance.accessedAttrs = instance.props === instance.attrs
  const scope = (instance.renderScope = new EffectScope())
  scope.run(() => devRender(instance))
}

/**
 * dev only
 */
function devRender(instance: VaporComponentInstance): void {
  const prev = setCurrentRenderingInstance(
    instance as unknown as ComponentInternalInstance,
  )
  try {
    instance.block =
      (instance.type.render
        ? callRender(instance.type.render, instance, instance.setupState!)
        : callWithErrorHandling(
            isFunction(instance.type) ? instance.type : instance.type.setup!,
            instance,
            ErrorCodes.SETUP_FUNCTION,
            [
              instance.props,
              {
                slots: instance.slots,
                attrs: instance.attrs,
                emit: instance.emit,
                expose: instance.expose,
              },
            ],
          )) || []
  } finally {
    setCurrentRenderingInstance(prev)
  }
}

export const emptyContext: GenericAppContext = {
  app: null as any,
  config: {},
  provides: /*@__PURE__*/ Object.create(null),
}

export class VaporComponentInstance<
  Props extends Record<string, any> = {},
  Emits extends EmitsOptions = {},
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
  TypeBlock extends Block = Block,
  TypeRefs extends Record<string, any> = Record<string, any>,
> implements GenericComponentInstance {
  vapor: true
  uid: number
  type: VaporComponent
  root: GenericComponentInstance | null
  parent: GenericComponentInstance | null
  appContext: GenericAppContext

  block: TypeBlock
  // VDOM can identify adopted SSR DOM with a placeholder VNode. Vapor adopts
  // raw nodes, so storing them in `block` would make logical consumers treat
  // them as rendered output. Keep temporary hydration ownership separate.
  pendingBlock?: Node | Node[]
  scope: EffectScope

  rawProps: RawProps
  rawSlots: RawSlots

  props: Readonly<Props>
  attrs: Record<string, any>
  propsDefaults: Record<string, any> | null

  slots: Slots

  scopeId?: string | null
  // The slot scope context this instance was created in, applied to the
  // effective root only (VDOM `-s` inheritance semantics).
  slotScopeIds?: string[] | null

  // to hold vnode props / slots in vdom interop mode
  rawPropsRef?: ShallowRef<any>
  rawSlotsRef?: ShallowRef<any>

  emit: EmitFn<Emits>
  emitted: Record<string, boolean> | null

  expose: (<T extends Record<string, any> = Exposed>(exposed: T) => void) &
    // compatible with vdom components
    string[]
  exposed: Exposed | null
  exposeProxy: Prettify<ShallowUnwrapRef<Exposed>> | null

  // for useTemplateRef()
  refs: TypeRefs
  // for provide / inject
  provides: Record<string, any>
  // for useId
  ids: [string, number, number]
  // for suspense
  suspense: SuspenseBoundary | null
  suspenseId: number
  asyncDep: Promise<any> | null
  asyncResolved: boolean
  asyncDepRegistered?: boolean
  restoreAsyncContext?: () => void | (() => void)
  deferredHydrationBoundary?: () => void

  hasFallthrough: boolean

  // for keep-alive
  shapeFlag?: number
  // Owns raw prop/slot isolation effects for cached components.
  inputScope?: EffectScope
  $key?: any
  // Share deferred updates across async roots on the KeepAlive component-root
  // chain so A(pending) -> B -> A renders only the final branch, matching VDOM.
  deferredKeepAliveUpdates?: DeferredKeepAliveUpdates

  ce?: ComponentCustomElementInterface

  // for v-once: caches props/attrs values to ensure they remain frozen
  // even when the component re-renders due to local state changes
  oncePropsCache?: Record<string | symbol, any>
  isOnce: boolean

  // lifecycle hooks
  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean
  isUpdating: boolean

  bc?: LifecycleHook // LifecycleHooks.BEFORE_CREATE
  c?: LifecycleHook // LifecycleHooks.CREATED
  bm?: LifecycleHook // LifecycleHooks.BEFORE_MOUNT
  m?: LifecycleHook // LifecycleHooks.MOUNTED
  bu?: LifecycleHook // LifecycleHooks.BEFORE_UPDATE
  u?: LifecycleHook // LifecycleHooks.UPDATED
  bum?: LifecycleHook // LifecycleHooks.BEFORE_UNMOUNT
  um?: LifecycleHook // LifecycleHooks.UNMOUNTED
  da?: LifecycleHook // LifecycleHooks.DEACTIVATED
  a?: LifecycleHook // LifecycleHooks.ACTIVATED
  rtg?: LifecycleHook // LifecycleHooks.RENDER_TRACKED
  rtc?: LifecycleHook // LifecycleHooks.RENDER_TRIGGERED
  ec?: LifecycleHook // LifecycleHooks.ERROR_CAPTURED
  sp?: LifecycleHook<() => Promise<unknown>> // LifecycleHooks.SERVER_PREFETCH

  // renderEffect creation counter for scheduler ordering.
  effectCount = 0

  // dev only
  setupState?: Exposed extends VaporRenderResult
    ? Record<string, any>
    : ShallowUnwrapRef<Exposed>
  devtoolsRawSetupState?: any
  hmrRerender?: () => void
  hmrReload?: (newComp: VaporComponent) => void
  propsOptions?: NormalizedPropsOptions
  emitsOptions?: ObjectEmitsOptions | null
  isSingleRoot?: boolean
  // for HMR rerender
  renderScope?: EffectScope

  /**
   * dev only flag to track whether $attrs was used during render.
   * If $attrs was used during render then the warning for failed attrs
   * fallthrough can be suppressed.
   */
  accessedAttrs: boolean = false

  // type only
  /**
   * @deprecated only used for JSX to detect props types.
   */
  // @ts-expect-error
  $props: Props

  constructor(
    comp: VaporComponent,
    rawProps?: RawProps | null,
    rawSlots?: LooseRawSlots | null,
    appContext?: GenericAppContext,
    once?: boolean,
    ce?: (instance: VaporComponentInstance) => void,
  ) {
    this.vapor = true
    this.uid = nextUid()
    this.type = comp
    this.parent = currentInstance

    if (currentInstance) {
      this.root = currentInstance.root
      this.appContext = currentInstance.appContext
      this.provides = currentInstance.provides
      this.ids = currentInstance.ids
    } else {
      this.root = this
      this.appContext = appContext || emptyContext
      this.provides = Object.create(this.appContext.provides)
      this.ids = ['', 0, 0]
    }

    this.block = null! // to be set
    this.scope = new EffectScope(true)
    this.isOnce = !!once

    this.emit = emit.bind(null, this) as EmitFn<Emits>
    this.expose = expose.bind(null, this) as any
    this.refs = EMPTY_OBJ as TypeRefs
    this.emitted = this.exposed = this.exposeProxy = this.propsDefaults = null

    // suspense related
    this.suspense = null
    this.suspenseId = 0
    if (__FEATURE_SUSPENSE__ && isSuspenseEnabled) {
      this.suspense = parentSuspense
      this.suspenseId = parentSuspense ? parentSuspense.pendingId : 0
    }
    this.asyncDep = null
    this.asyncResolved = false

    this.isMounted =
      this.isUnmounted =
      this.isUpdating =
      this.isDeactivated =
        false

    // init props
    // Snapshot raw parent inputs before creating proxies so delayed reads from
    // v-once children cannot observe later parent updates.
    this.rawProps =
      this.isOnce && rawProps
        ? snapshotRawProps(rawProps)
        : rawProps || EMPTY_OBJ
    // a custom element host mutates its props object after creation, so its
    // attrs key set is never static
    this.hasFallthrough = !!ce || hasFallthroughAttrs(comp, this.rawProps)
    if (rawProps || comp.props) {
      const [propsHandlers, attrsHandlers] = getPropsProxyHandlers(comp)
      this.attrs = new Proxy(this, attrsHandlers)
      this.props = (
        comp.props
          ? new Proxy(this, propsHandlers!)
          : isFunction(comp)
            ? this.attrs
            : EMPTY_OBJ
      ) as Props
    } else {
      this.props = this.attrs = EMPTY_OBJ as Props
    }

    // init slots
    const normalizedRawSlots = normalizeRawSlots(rawSlots)
    this.rawSlots = normalizedRawSlots || EMPTY_OBJ
    this.slots = (
      normalizedRawSlots
        ? new Proxy(normalizedRawSlots, dynamicSlotsProxyHandlers)
        : EMPTY_OBJ
    ) as Slots

    this.scopeId = getCurrentScopeId()
    this.slotScopeIds = currentSlotScopeIds

    // apply custom element special handling
    if (ce) {
      ce(this)
    }

    if (__DEV__) {
      // in dev, mark attrs accessed if optional props (attrs === props)
      if (this.props === this.attrs) {
        this.accessedAttrs = true
      } else {
        const attrs = this.attrs
        const instance = this
        this.attrs = new Proxy(attrs, {
          get(target, key, receiver) {
            instance.accessedAttrs = true
            return Reflect.get(target, key, receiver)
          },
        })
      }
    }
  }

  /**
   * Expose `getKeysFromRawProps` on the instance so it can be used in code
   * paths where it's needed, e.g. `useModel`
   */
  rawKeys(): string[] {
    return getKeysFromRawProps(this.rawProps)
  }
}

export function isVaporComponent(
  value: unknown,
): value is VaporComponentInstance {
  return value instanceof VaporComponentInstance
}

/**
 * Resolve an asset component by name before passing it to the fallback helper;
 * a string passed directly to `createComponentWithFallback` is plain element
 * fallback, not a component name.
 */
export function createAssetComponent(
  name: string,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
  maybeSelfReference?: boolean,
  appContext?: GenericAppContext,
): HTMLElement | VaporComponentInstance {
  return createComponentWithFallback(
    resolveComponent(name, maybeSelfReference) as VaporComponent | string,
    rawProps,
    rawSlots,
    isSingleRoot,
    once,
    appContext,
  )
}

/**
 * Used when a component cannot be resolved at compile time
 * and needs rely on runtime resolution - where it might fallback to a plain
 * element if the resolution fails.
 */
export function createComponentWithFallback(
  comp: VaporComponent | typeof NULL_DYNAMIC_COMPONENT | string,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
  appContext?: GenericAppContext,
): HTMLElement | VaporComponentInstance {
  if (comp === NULL_DYNAMIC_COMPONENT) {
    if (isHydrating && currentHydrationNode) {
      if (isReusableNullComponentAnchor(currentHydrationNode)) {
        const node = currentHydrationNode
        if (isComment(node, '')) {
          advanceHydrationNode(node)
        }
        return node as any as HTMLElement
      }

      const nextAnchor = nextLogicalSibling(currentHydrationNode)
      if (nextAnchor && isReusableNullComponentAnchor(nextAnchor)) {
        // Keep the cursor on the stale SSR node before `nextAnchor` so the
        // owning DynamicFragment can trim that range on hydrate exit and then
        // advance past the reused null-branch anchor in one place.
        return nextAnchor as any as HTMLElement
      }
    }
    return (__DEV__
      ? createComment('ndc')
      : createTextNode('')) as any as HTMLElement
  }

  if (!isString(comp)) {
    return createComponent(
      comp,
      rawProps,
      rawSlots,
      isSingleRoot,
      once,
      appContext,
    )
  }

  return createPlainElement(comp, rawProps, rawSlots, isSingleRoot, once)
}

function isReusableNullComponentAnchor(node: Node): boolean {
  return (
    isComment(node, '') ||
    // Dev-only: a runtime anchor an enclosing dynamic fragment already created
    // carries that fragment's debug label as its comment data. Prod builds
    // create unlabeled text nodes, so these comparisons never match there.
    (__DEV__ &&
      (isComment(node, 'dynamic-component') ||
        isComment(node, 'async component') ||
        isComment(node, 'keyed')))
  )
}

export function createPlainElement(
  comp: string,
  rawProps?: LooseRawProps | null,
  rawSlots?: LooseRawSlots | null,
  isSingleRoot?: boolean,
  once?: boolean,
): HTMLElement {
  rawSlots = normalizeRawSlots(rawSlots)
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  let hydrationCursor: HydrationCursor | null = null
  if (isHydrating) {
    resolvePendingSlotContent()
    hydrationCursor = enterHydrationCursor()
  } else {
    resetInsertionState()
  }

  const defaultSlot = rawSlots && getSlot(rawSlots as RawSlots, 'default')
  const hasDynamicSlots = !!rawSlots && !!rawSlots.$
  const adoptHydrationChildren = !!defaultSlot
  const hydrationTemplate =
    hasDynamicSlots && !defaultSlot ? `<${comp}><!></${comp}>` : `<${comp}/>`
  const el = isHydrating
    ? (adoptTemplate(
        currentHydrationNode!,
        hydrationTemplate,
        adoptHydrationChildren,
      ) as HTMLElement)
    : createElement(comp)

  // mark single root
  ;(el as any).$root = isSingleRoot

  // Adopted elements already carry SSR scope attrs; mismatch-recreated ones
  // were client-built and stamp like a client render.
  if (!isHydrating || isRecreatedNode(el)) {
    const scopeId = getCurrentScopeId()
    if (scopeId) el.setAttribute(scopeId, '')
    if (currentSlotScopeIds) setElementScopeIds(el, currentSlotScopeIds)
  }

  if (rawProps) {
    const setFn = () =>
      setDynamicProps(el, [resolveDynamicProps(rawProps as RawProps)])
    if (once) setFn()
    else renderEffect(setFn)
  }

  if (rawSlots) {
    let nextNode: Node | null = null
    if (isHydrating) {
      nextNode = nextLogicalSibling(el)
      let child = el.firstChild
      if (rawSlots.$ && !child) {
        // SSR may omit default-slot nodes for dynamic native children.
        // Seed a local anchor so the inner fragment can locate and reuse it.
        child = el.appendChild(
          claimAnchor(__DEV__ ? createComment('') : createTextNode()),
        )
      }
      setCurrentHydrationNode(child)
    }
    if (rawSlots.$) {
      // Dynamic element children don't own an SSR slot-range anchor, so flag
      // this as a native-children fragment. Hydration keys off `nativeChildren`
      // to inject/reuse its own anchor instead of trying to reuse
      // SlotFragment-style anchors. The hydrating label stays empty so the
      // runtime anchor renders as `<!---->`.
      const frag = new DynamicFragment(
        NATIVE_CHILDREN,
        __DEV__ ? (isHydrating ? '' : 'slot') : undefined,
      )
      renderEffect(() => frag.update(getSlot(rawSlots as RawSlots, 'default')))
      if (!isHydrating) insert(frag, el)
    } else {
      const slot = getSlot(rawSlots as RawSlots, 'default')
      if (slot) {
        const block = slot()
        if (!isHydrating) insert(block, el)
      }
    }
    if (isHydrating) {
      setCurrentHydrationNode(nextNode)
    }
  }

  finishBlockCreation(
    el,
    undefined,
    hydrationCursor,
    _insertionParent,
    _insertionAnchor,
  )

  return el
}

export function mountComponent(
  instance: VaporComponentInstance,
  parent: ParentNode,
  anchor?: Node | null,
): void {
  if (
    __FEATURE_SUSPENSE__ &&
    isSuspenseEnabled &&
    instance.suspense &&
    instance.asyncDep &&
    !instance.asyncResolved
  ) {
    // Moving a still-pending instance, such as a keyed reorder or KeepAlive
    // re-entry, retries `mountComponent`. `insert` relocates its already-mounted
    // DOM without registering the async dependency again.
    if (instance.asyncDepRegistered) {
      if (instance.pendingBlock) {
        insert(instance.pendingBlock, parent, anchor)
      } else if (instance.block) {
        insert(instance.block, parent, anchor)
      }
      if (
        isKeepAliveEnabled &&
        instance.shapeFlag! & ShapeFlags.COMPONENT_KEPT_ALIVE
      ) {
        // A cached pending instance still needs its initial mount after setup
        // resolves. Restore only its active state; KeepAlive activation requires
        // a mounted block.
        instance.isDeactivated = false
      }
      return
    }

    const suspense = instance.suspense
    const deferred = isKeepAliveEnabled && deferKeepAliveRenderEffects(instance)
    const hydrating = isHydrating
    if (!hydrating) {
      // Keep a placeholder in the DOM while async setup is pending so
      // sibling insertion and moves use the component's current position.
      instance.block = createComment('')
      insert(instance.block, parent, anchor)
    }

    instance.asyncDepRegistered = true
    const component = instance.type
    let asyncSetupFinished = false
    const finishAsyncSetup = (setupResult: any): void => {
      if (asyncSetupFinished) return
      asyncSetupFinished = true
      instance.asyncResolved = true
      // Restore hydrating mode for the final mount so stale-generation
      // recovery does not fall back to fresh DOM insertion.
      const reset =
        instance.restoreAsyncContext && instance.restoreAsyncContext()
      // handleSetupResult may invoke the render function, which creates
      // render effects that must be owned by this instance and its scope.
      const handleResult = () => {
        const prevInstance = setCurrentInstance(instance)
        const prevSub = setActiveSub()
        try {
          handleSetupResult(setupResult, component, instance)
        } finally {
          setActiveSub(prevSub)
          restoreCurrentInstance(prevInstance)
        }
      }
      try {
        const pendingBlock = hydrating ? instance.pendingBlock! : instance.block
        // Use the pending DOM's live boundary because it may have moved while
        // setup was suspended.
        const { parentNode, nextNode } = findBlockBoundary(pendingBlock)
        if (hydrating) {
          withDeferredHydrationBoundary(() => {
            handleResult()
            mountComponent(instance, parentNode as ParentNode, nextNode)
            if (instance.deferredHydrationBoundary) {
              instance.deferredHydrationBoundary()
            }
          })
        } else {
          handleResult()
          mountComponent(instance, parentNode as ParentNode, nextNode)
          remove(pendingBlock, parentNode as ParentNode)
        }
      } finally {
        if (hydrating) {
          instance.pendingBlock = undefined
          instance.deferredHydrationBoundary = undefined
        }
        instance.restoreAsyncContext = undefined
        if (reset) reset()
      }
    }

    suspense.registerDep(instance, setupResult => {
      if (deferred) {
        if (deferred.pendingRoot === instance) {
          deferred.pendingRoot = undefined
        }
        // Reserve one flush for the whole async root chain, gated on the
        // nearest boundary like VDOM's deferred retry. If the boundary
        // discards that generation, the marked flush moves to the ordinary
        // post queue so the surviving Vapor owners cannot stay dirty forever.
        if (!deferred.flushQueued) {
          deferred.flushQueued = true
          queuePostRenderEffect(deferred.flushJob, undefined, deferred.suspense)
        }
      }
      finishAsyncSetup(setupResult)
    })

    if (deferred) {
      const state = deferred
      // Suspense skips the callback above for unmounted roots or stale
      // generations. If the replacement generation is already gone, complete
      // a surviving instance before replaying deferred owner updates. The
      // normal callback runs first and makes this a no-op.
      instance.asyncDep!.catch(NOOP).then(setupResult => {
        if (asyncSetupFinished) return
        // A foreign pending generation cannot own this surviving instance's
        // mount hooks because discarding it would discard those hooks too.
        if (
          !instance.isUnmounted &&
          !suspense.isUnmounted &&
          !suspense.pendingBranch
        ) {
          finishAsyncSetup(setupResult)
        }
        if (!state.flushQueued && state.pendingRoot === instance) {
          settleDeferredKeepAliveUpdates(state)
        }
      })
    }
    return
  }

  // A pending async component may be cached before its initial mount.
  if (
    isKeepAliveEnabled &&
    instance.shapeFlag! & ShapeFlags.COMPONENT_KEPT_ALIVE &&
    instance.isMounted
  ) {
    ;(instance.parent as KeepAliveInstance)!.ctx.activate(
      instance,
      parent,
      anchor,
    )
    return
  }

  // custom element style injection
  const { root, type } = instance as GenericComponentInstance
  if (root && root.ce && (root.ce as VaporElement)._hasShadowRoot()) {
    root.ce!._injectChildStyle(
      type,
      instance.parent ? instance.parent.type : undefined,
    )
  }

  if (__DEV__) {
    startMeasure(instance, `mount`)
  }
  if (instance.bm) invokeArrayFns(instance.bm)
  if (!isHydrating) {
    // Root-only ids (stamp + interop carriers) land before insertion; see
    // applyRootScopeIds for the delegation rule.
    applyComponentScopeIds(instance)
    // pass the owning suspense so enter transitions are skipped while
    // mounting into a pending suspense's hidden container (vdom parity);
    // the enter runs when the resolved branch is moved into the real tree.
    insert(instance.block, parent, anchor, instance.suspense)
  } else {
    hydrateComponentScopeIds(instance)
  }
  if (instance.m) {
    queuePostRenderEffect(instance.m!, undefined, instance.suspense)
  }
  if (
    isKeepAliveEnabled &&
    instance.shapeFlag! & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE &&
    instance.a
  ) {
    queuePostRenderEffect(instance.a!, undefined, instance.suspense)
  }
  instance.isMounted = true
  if (__DEV__) {
    endMeasure(instance, `mount`)
  }
}

export function unmountComponent(
  instance: VaporComponentInstance,
  parentNode?: ParentNode,
  parentSuspense: SuspenseBoundary | null = instance.suspense,
): void {
  if (
    __FEATURE_SUSPENSE__ &&
    isSuspenseEnabled &&
    isInteropEnabled &&
    currentUnmountSuspense !== parentSuspense
  ) {
    runWithUnmountSuspense(parentSuspense, () =>
      unmountComponent(instance, parentNode, parentSuspense),
    )
    return
  }

  // Skip unmount for kept-alive components - deactivate if called from remove()
  if (
    isKeepAliveEnabled &&
    instance.shapeFlag! & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE &&
    instance.parent &&
    instance.parent.vapor &&
    (instance.parent as KeepAliveInstance).ctx
  ) {
    if (parentNode) {
      ;(instance.parent as KeepAliveInstance)!.ctx.deactivate(
        instance,
        parentSuspense,
      )
    }
    return
  }

  const pendingAsyncSetup =
    __FEATURE_SUSPENSE__ && !!instance.asyncDep && !instance.asyncResolved

  if (
    !instance.isUnmounted &&
    (instance.isMounted ||
      // An async setup component can be unmounted before it finishes mounting.
      // It still needs normal unmount cleanup and must be marked unmounted so
      // a later async resolution is ignored.
      pendingAsyncSetup)
  ) {
    if (__DEV__) {
      unregisterHMR(instance)
    }
    invalidateMount(instance.m)
    invalidateMount(instance.a)
    if (instance.bum) {
      invokeArrayFns(instance.bum)
    }

    if (isKeepAliveEnabled) {
      const inputScope = instance.inputScope
      if (inputScope) inputScope.stop()
    }
    instance.scope.stop()

    if (instance.um) {
      queuePostRenderEffect(instance.um!, undefined, parentSuspense)
    }
    instance.isUnmounted = true
  }

  if (__FEATURE_SUSPENSE__ && isSuspenseEnabled && pendingAsyncSetup) {
    if (instance.pendingBlock) {
      // Without parentNode this is state-only teardown. Leave the DOM intact
      // for its enclosing owner, and retain the descriptor in case a
      // subsequent Vapor block removal needs it.
      if (parentNode) {
        const pendingBlock = instance.pendingBlock
        const { parentNode: blockParent } = findBlockBoundary(pendingBlock)
        if (blockParent) {
          remove(pendingBlock, blockParent as ParentNode)
        }
        instance.pendingBlock = undefined
      }
    } else if (instance.block instanceof Comment) {
      // CSR placeholders are component-owned, so always detach them from their
      // live parent even when VDOM owns an enclosing removal.
      const blockParent = instance.block.parentNode
      if (blockParent) {
        remove(instance.block, blockParent)
      }
    }
  } else if (parentNode) {
    if (instance.block) remove(instance.block, parentNode)
  }
  if (pendingAsyncSetup) {
    instance.restoreAsyncContext = undefined
    instance.deferredHydrationBoundary = undefined
  }
}

export function getExposed(
  instance: GenericComponentInstance,
): Record<string, any> | undefined {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(markRaw(instance.exposed), {
        get: (target, key) => unref(target[key as any]),
      }))
    )
  }
}

/**
 * The shared traversal of the effective-root chain — root element
 * resolution, scope id owner registration, interop carrier publication —
 * encoding the chain rules (teleport exclusion, slot outlet breaks,
 * comment-filtered arrays, component descent) once. Fallthrough attrs use
 * their own component-bounded resolver (resolveFallthroughRoot), which
 * mirrors these rules but stops at component boundaries.
 */
export interface RootChainVisitor {
  onDynamicFragment?: (frag: DynamicFragment) => void
  // Fired on component descent, including an entry block that is itself a
  // component.
  onComponent?: (instance: VaporComponentInstance) => void
  // Fired at a vnode-backed interop fragment, terminating the descent there
  // (the fragment carries the chain across into vdom).
  onInteropFragment?: (frag: InteropFragment) => void
  // Slot outlets break the effective-root chain for scope id inheritance.
  excludeSlotOutlets?: boolean
}

export function getRootElement(
  block: Block,
  visitor?: RootChainVisitor,
): Element | undefined {
  if (block instanceof Element) {
    return block
  }

  if (isVaporComponent(block)) {
    if (visitor && visitor.onComponent) visitor.onComponent(block)
    return getRootElement(block.block, visitor)
  }

  if (isFragment(block) && !(isTeleportEnabled && isTeleportFragment(block))) {
    if (visitor) {
      if (visitor.excludeSlotOutlets && isSlotOutletFragment(block)) {
        return
      }
      if (isDynamicFragment(block) && visitor.onDynamicFragment) {
        visitor.onDynamicFragment(block)
      }
      if (
        isInteropEnabled &&
        visitor.onInteropFragment &&
        isInteropFragment(block) &&
        block.vnode
      ) {
        visitor.onInteropFragment(block)
        return
      }
    }
    const { nodes } = block
    if (nodes instanceof Element && (nodes as any).$root) {
      return nodes
    }
    return getRootElement(nodes, visitor)
  }

  // The root node contains comments. It is necessary to filter out
  // the comment nodes and return a single root node.
  // align with vdom behavior
  if (isArray(block)) {
    // Structure first, visit after: a multi-root array has no effective
    // root, and firing the visitor on a branch before that verdict would
    // leak side effects (owner registration, carrier publication) that
    // multi-root semantics forbid.
    let single: Block | undefined
    let hasComment = false
    for (const b of block) {
      if (b instanceof Comment) {
        hasComment = true
        continue
      }
      // only a lone eligible branch alongside comments can hold the root
      if (single !== undefined) return
      single = b
    }
    if (!hasComment || single === undefined) return
    return getRootElement(single, visitor)
  }
}

/**
 * Descends the same effective-root rules as getRootElement but stops at the
 * first component instead of resolving an element. Used to verify `child`
 * sits on `parent`'s root chain when the chain passes through fragments
 * (where `parent.block === child` cannot see the link).
 */
export function getRootChainComponent(
  block: Block,
): VaporComponentInstance | undefined {
  while (true) {
    if (isVaporComponent(block)) return block
    if (
      isFragment(block) &&
      !(isTeleportEnabled && isTeleportFragment(block))
    ) {
      if (isSlotOutletFragment(block)) return
      block = block.nodes
      continue
    }
    if (isArray(block)) {
      let single: Block | undefined
      let hasComment = false
      for (const b of block) {
        if (b instanceof Comment) {
          hasComment = true
          continue
        }
        if (single !== undefined) return
        single = b
      }
      if (hasComment && single !== undefined) {
        block = single
        continue
      }
      return
    }
    return
  }
}

function handleSetupResult(
  setupResult: any,
  component: VaporComponent,
  instance: VaporComponentInstance,
) {
  if (__DEV__) {
    pushWarningContext(instance)
  }

  if (!isBlock(setupResult)) {
    if (isFunction(component)) {
      if (__DEV__) {
        warn(`Functional vapor component must return a block directly.`)
      }
      instance.block = []
    } else if (!component.render) {
      if (__DEV__) {
        warn(
          `Vapor component setup() returned non-block value, and has no render function.`,
        )
      }
      // setup either threw or returned a non-block value: fall back to an
      // empty block so mount / unmount can proceed and the error can
      // propagate to parent error boundaries
      instance.block = []
    } else {
      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        instance.devtoolsRawSetupState = setupResult
      }
      if (__DEV__) {
        instance.setupState = createDevSetupStateProxy(proxyRefs(setupResult))
        runDevRender(instance)
      } else {
        // component has a render function but no setup function
        // (typically components with only a template and no state)
        instance.block =
          callRender(component.render, instance, setupResult) || []
      }
    }
  } else {
    instance.block = setupResult as Block
  }

  applyComponentFallthrough(instance)

  if (__DEV__) {
    popWarningContext()
  }
}

// single root, inherit attrs. Gate on fallthrough *potential* only:
// attrs may be empty now and gain keys later, so emptiness is handled
// reactively inside the render effect.
export function applyComponentFallthrough(
  instance: VaporComponentInstance,
): void {
  if (instance.hasFallthrough && instance.type.inheritAttrs !== false) {
    // attach attrs to the root element, or to root dynamic fragments so they
    // can be (re-)applied during each branch update
    applyFallthroughAttrs(
      instance.block,
      instance,
      __DEV__ ? instance.renderScope : undefined,
    )
  }
}

// Attach fallthrough attrs to the single root element. When the root sits
// under dynamic fragments (e.g. v-if), the attrs are (re-)applied on each
// branch update via the fragments' fallthrough hook. Slots and teleports
// warn instead of receiving the attrs, consistent with VDOM behavior.
function applyFallthroughAttrs(
  block: Block,
  instance: VaporComponentInstance,
  scope?: EffectScope,
): void {
  const state: FallthroughResolveState = { parentScope: scope }
  const root = resolveFallthroughRoot(block, state)
  const { fragments, innermost, hasSlotFragment } = state

  if (fragments) {
    for (const frag of fragments) {
      // Nested dynamic fragments need their own fallthrough hook. The chain
      // keeps its registration even when the current branch has no element
      // root, so future branch updates can still apply.
      registerDynamicFragmentFallthroughAttrs(frag, instance)
    }
  }

  if (root && !hasSlotFragment) {
    let ownerScope = scope
    if (innermost) {
      // A compiler-proven no-scope branch may have rendered without a scope;
      // create one so the effect dies with the branch — parented under the
      // nearest enclosing branch scope so hierarchical pause/resume
      // (KeepAlive caching) reaches it.
      ownerScope = innermost.scope ||= state.parentScope
        ? state.parentScope.run(() => new EffectScope())!
        : new EffectScope()
    }
    const applyEffect = () =>
      renderEffect(() =>
        applyFallthroughProps(root, resolveFallthroughAttrs(instance)),
      )
    // ensure the render effect is cleaned up when the branch scope is stopped
    ownerScope ? ownerScope.run(applyEffect) : applyEffect()
  } else if (__DEV__) {
    const accessedAttrs = instance.accessedAttrs
    const fallthroughAttrs = resolveFallthroughAttrs(instance)
    if (
      Object.keys(fallthroughAttrs).length &&
      (hasSlotFragment ||
        (fragments && state.hasNonSingleRoot) ||
        (isTeleportEnabled && containsTeleportFragment(block)) ||
        (!accessedAttrs &&
          (block instanceof Text || (isArray(block) && block.length))))
    ) {
      warnExtraneousAttributes(instance.attrs)
    }
  }
}

interface FallthroughResolveState {
  // non-slot dynamic fragments on the effective-root path, outermost first
  fragments?: DynamicFragment[]
  // the innermost of those — its branch scope owns the fallthrough effect
  innermost?: DynamicFragment
  // nearest enclosing branch scope; lifecycle parent for retrofitted scopes
  parentScope?: EffectScope
  hasSlotFragment?: boolean
  // the innermost fragment's current branch is multi-root: fragments stay
  // registered for future branches while the current render warns
  hasNonSingleRoot?: boolean
}

// Single-pass effective-root resolution for fallthrough: descends the same
// effective-root rules as getRootElement, but stops at components (their
// attrs fold at their own creation boundary) and collects the dynamic
// fragment chain, scope ownership, and warning inputs along the way.
function resolveFallthroughRoot(
  block: Block,
  state: FallthroughResolveState,
): Element | undefined {
  if (block instanceof Element) {
    return block
  }

  if (isVaporComponent(block)) return

  if (isFragment(block) && !(isTeleportEnabled && isTeleportFragment(block))) {
    if (isDynamicFragment(block)) {
      // Slot outlets warn instead of inheriting attrs, and the descent stops
      // there: slot content is rendered by the parent, so fragments inside it
      // must not register a fallthrough hook — a later branch switch would
      // re-apply from the branch alone, with the slot boundary out of view.
      if (block.__vf & SLOT) {
        state.hasSlotFragment = true
        return
      } else {
        ;(state.fragments ||= []).push(block)
        if (state.innermost && state.innermost.scope) {
          state.parentScope = state.innermost.scope
        }
        state.innermost = block
      }
    }
    const { nodes } = block
    if (nodes instanceof Element && (nodes as any).$root) {
      return nodes
    }
    const el = resolveFallthroughRoot(nodes, state)
    if (!el && state.innermost === block) {
      state.hasNonSingleRoot =
        isArray(nodes) && nodes.some(child => !(child instanceof Comment))
    }
    return el
  }

  // multi-root arrays have no effective root; only a lone eligible branch
  // alongside comments can hold one (vdom comment-filtering alignment)
  if (isArray(block)) {
    let single: Block | undefined
    let hasComment = false
    for (const b of block) {
      if (b instanceof Comment) {
        hasComment = true
        continue
      }
      if (single !== undefined) return
      single = b
    }
    if (!hasComment || single === undefined) return
    return resolveFallthroughRoot(single, state)
  }
}

function containsTeleportFragment(block: Block): boolean {
  if (isTeleportFragment(block)) return true
  if (isArray(block)) {
    return block.some(
      child => !(child instanceof Comment) && containsTeleportFragment(child),
    )
  }
  return isFragment(block) && containsTeleportFragment(block.nodes)
}

function registerDynamicFragmentFallthroughAttrs(
  frag: DynamicFragment,
  instance: VaporComponentInstance,
): void {
  // one application per fragment: attrs fold at component boundaries, so
  // only the first registering instance can sit on this fragment's chain
  if (frag.fallthrough) return

  frag.fallthrough = nodes =>
    applyFallthroughAttrs(nodes, instance, frag.scope!)
}

export interface DeferredKeepAliveUpdates {
  effects: SchedulerJob[]
  owners: VaporComponentInstance[]
  suspense: SuspenseBoundary
  pendingId: number
  pendingRoot?: VaporComponentInstance
  flushQueued: boolean
  flushJob: SchedulerJob
}

/**
 * A deferred state stays live while its async root is pending or its flush is
 * queued for the same Suspense generation. The flush is requeued if that
 * generation is discarded, so `flushQueued` cannot strand buffered updates.
 */
export function isDeferredKeepAliveStateLive(
  state: DeferredKeepAliveUpdates,
): boolean {
  const suspense = state.suspense
  if (suspense.isUnmounted || state.pendingId !== suspense.pendingId) {
    return false
  }
  if (state.flushQueued) return true
  const root = state.pendingRoot
  return !!root && !root.isUnmounted
}

export function settleDeferredKeepAliveUpdates(
  state: DeferredKeepAliveUpdates,
  currentJob?: SchedulerJob,
): void {
  const { effects, owners } = state
  // Idempotent: a settle hook and a stale-detecting render effect may both
  // settle the same state.
  state.effects = []
  state.owners = []
  state.pendingRoot = undefined
  for (let i = 0; i < owners.length; i++) {
    if (owners[i].deferredKeepAliveUpdates === state) {
      owners[i].deferredKeepAliveUpdates = undefined
    }
  }
  // Replay buffered updates so owner effects captured before the state went
  // stale are not lost. The detecting job joins the batch so the whole set
  // runs in scheduler order - an outer removal must still precede a buffered
  // inner update; stopped jobs no-op on their dirty check.
  if (currentJob && !effects.includes(currentJob)) {
    effects.push(currentJob)
  }
  if (effects.length > 1) {
    effects.sort((a, b) => a.order! - b.order!)
  }
  for (let i = 0; i < effects.length; i++) {
    const job = effects[i]
    callWithErrorHandling(
      job,
      job.i,
      job.i ? ErrorCodes.COMPONENT_UPDATE : ErrorCodes.SCHEDULER,
    )
  }
}

function deferKeepAliveRenderEffects(
  instance: VaporComponentInstance,
): DeferredKeepAliveUpdates | undefined {
  const suspense = instance.suspense!
  const owners: VaporComponentInstance[] = []
  let keepAlive: VaporComponentInstance | undefined
  if (isHydrating) {
    // Ancestor blocks are not committed during hydration. Preserve the direct
    // KeepAlive-owner path; wrapper roots cannot be proven here.
    const owner = instance.parent
    if (
      owner &&
      owner.vapor &&
      isKeepAlive(owner) &&
      owner.suspense === suspense
    ) {
      keepAlive = owner as VaporComponentInstance
      owners.push(keepAlive)
    }
  } else {
    let child: Block = instance
    let owner = instance.parent
    while (owner && owner.vapor && owner.suspense === suspense) {
      const vaporOwner = owner as VaporComponentInstance
      let root = vaporOwner.block
      // Dynamic component and v-if roots use fragments in Vapor where VDOM
      // exposes the active component directly as `subTree.component`.
      while (isDynamicFragment(root) && !(root.__vf & SLOT)) {
        root = root.nodes
      }
      if (root !== child) return

      owners.push(vaporOwner)
      if (isKeepAlive(owner)) {
        // Use the outermost KeepAlive so nested async roots share one state,
        // matching VDOM's component-root update.
        keepAlive = vaporOwner
      }

      child = vaporOwner
      owner = vaporOwner.parent
    }
  }

  if (!keepAlive) return

  let deferred = keepAlive.deferredKeepAliveUpdates
  if (
    !deferred ||
    deferred.suspense !== suspense ||
    deferred.pendingId !== instance.suspenseId
  ) {
    // Runs when the boundary resolves (or on the resolving tick when it
    // has no pending branch), ahead of setup-created Suspense effects.
    const flushJob: SchedulerJob = () => {
      state.flushQueued = false
      // A resolved root may synchronously mount another pending async root.
      if (keepAlive.deferredKeepAliveUpdates !== state || state.pendingRoot) {
        return
      }
      settleDeferredKeepAliveUpdates(state)
    }
    flushJob.flags = SchedulerJobFlags.REQUEUE_ON_SUSPENSE_DISCARD
    const state: DeferredKeepAliveUpdates = {
      effects: [],
      owners: [],
      suspense,
      pendingId: instance.suspenseId,
      pendingRoot: instance,
      flushQueued: false,
      flushJob,
    }
    // Owner effects settle a stale state before mounting a new root. Nested
    // roots from an accepted continuation share this generation and reuse it.
    deferred = state
  } else {
    deferred.pendingRoot = instance
  }

  for (let i = 0; i < owners.length; i++) {
    const owner = owners[i]
    if (owner.deferredKeepAliveUpdates !== deferred) {
      owner.deferredKeepAliveUpdates = deferred
      deferred.owners.push(owner)
    }
  }
  return deferred
}
