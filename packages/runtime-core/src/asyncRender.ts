import {
  AsyncComputedError,
  type ComputedRefImpl,
  PendingComputed,
  type ReactiveEffect,
} from '@vue/reactivity'
import type { GenericComponentInstance } from './component'
import type { SuspenseBoundary } from './components/Suspense'
import {
  ErrorCodes,
  callWithAsyncErrorHandling,
  handleError,
} from './errorHandling'
import { queueJob, queuePostFlushCb } from './scheduler'
import { warn } from './warning'

interface AsyncRenderDependency {
  owner: GenericComponentInstance
  boundary: SuspenseBoundary
  generation: number
  pending: PendingComputed | AsyncComputedError
  counted: boolean
}

/** @internal Shared by VDOM and Vapor render effects. */
export interface AsyncRenderState {
  dependencies: Map<ReactiveEffect, AsyncRenderDependency>
  commits: Map<ReactiveEffect, () => void>
  pending: boolean
  fallback: boolean
  flush: () => void
}

const dependencies = new WeakMap<ReactiveEffect, AsyncRenderDependency>()
const queuedBoundaries = new WeakMap<ReactiveEffect, SuspenseBoundary>()

/** @internal A readonly getter can start returning promises on a later read. */
export function trackAsyncRender(
  effect: ReactiveEffect,
  boundary: SuspenseBoundary | null,
): void {
  if (boundary && !boundary.asyncRender) {
    for (let link = effect.deps; link; link = link.nextDep) {
      if ((link.dep as ComputedRefImpl).__v_isReadonly) {
        getState(boundary)
        break
      }
    }
  }
}

function getState(boundary: SuspenseBoundary): AsyncRenderState {
  return (
    boundary.asyncRender ||
    (boundary.asyncRender = {
      dependencies: new Map(),
      commits: new Map(),
      pending: false,
      fallback: false,
      flush() {
        const state = boundary.asyncRender!
        if (boundary.isUnmounted || state.dependencies.size) return
        for (const [effect, commit] of state.commits) {
          state.commits.delete(effect)
          queuedBoundaries.delete(effect)
          if (effect.active) commit()
          if (state.dependencies.size) return
        }
        if (state.pending) {
          state.pending = false
          const props = boundary.vnode.props
          if (props && props.onResolve)
            callWithAsyncErrorHandling(
              props.onResolve,
              boundary.parentComponent,
              ErrorCodes.COMPONENT_EVENT_HANDLER,
            )
          queuePostFlushCb(boundary.effects)
          boundary.effects = []
        }
      },
    })
  )
}

/** @internal */
export function suspendAsyncRender(
  error: unknown,
  effect: ReactiveEffect,
  owner: GenericComponentInstance,
  retry: () => void,
  boundary: SuspenseBoundary | null = owner.suspense,
): boolean {
  if (
    !(error instanceof PendingComputed || error instanceof AsyncComputedError)
  )
    return false
  if (!boundary) {
    if (error instanceof AsyncComputedError)
      handleError(error.error, owner, ErrorCodes.RENDER_FUNCTION)
    else if (__DEV__)
      warn(
        'A component read a pending computed value, but no <Suspense> boundary was found in the parent component tree.',
      )
    return true
  }
  const state = getState(boundary)
  state.commits.delete(effect)
  let dep = dependencies.get(effect)
  if (dep && dep.pending === error && dep.generation === boundary.pendingId)
    return true
  if (
    dep &&
    (dep.boundary !== boundary || dep.generation !== boundary.pendingId)
  ) {
    cancelAsyncRender(effect)
    dep = undefined
  }
  if (!dep) {
    dep = {
      owner,
      boundary,
      generation: boundary.pendingId,
      pending: error,
      counted: !!boundary.pendingBranch,
    }
    if (dep.counted) boundary.deps++
    dependencies.set(effect, dep)
    state.dependencies.set(effect, dep)
  } else {
    dep.pending = error
  }
  if (!boundary.pendingBranch && !state.pending) {
    state.pending = true
    const props = boundary.vnode.props
    if (props && props.onPending)
      callWithAsyncErrorHandling(
        props.onPending,
        boundary.parentComponent,
        ErrorCodes.COMPONENT_EVENT_HANDLER,
      )
    const generation = boundary.pendingId
    const fallback = () => {
      if (
        state.pending &&
        !boundary.isUnmounted &&
        boundary.pendingId === generation
      ) {
        boundary.fallback(boundary.vnode.ssFallback!, true)
      }
    }
    if (boundary.timeout === 0) fallback()
    else if (boundary.timeout > 0) setTimeout(fallback, boundary.timeout)
  }
  if (error instanceof AsyncComputedError) {
    if (state.fallback && boundary.pendingBranch) {
      for (const dep of state.dependencies.values()) {
        if (dep.counted) {
          dep.counted = false
          boundary.deps--
        }
      }
      boundary.resolve()
    }
    handleError(error.error, owner, ErrorCodes.RENDER_FUNCTION)
  } else {
    const pending = error
    error.promise.then(() => {
      const current = dependencies.get(effect)
      if (
        current &&
        current.pending === pending &&
        effect.active &&
        owner.scope.active &&
        !boundary.isUnmounted &&
        current.generation === boundary.pendingId
      )
        retry()
    })
  }
  return true
}

/** @internal */
export function cancelAsyncRender(effect: ReactiveEffect): void {
  const queued = queuedBoundaries.get(effect)
  if (queued) {
    queued.asyncRender!.commits.delete(effect)
    queuedBoundaries.delete(effect)
  }
  const dep = dependencies.get(effect)
  if (!dep) return
  dependencies.delete(effect)
  const { boundary } = dep
  const state = boundary.asyncRender!
  state.dependencies.delete(effect)
  state.commits.delete(effect)
  if (
    dep.generation === boundary.pendingId &&
    dep.counted &&
    !boundary.isUnmounted
  ) {
    if (--boundary.deps === 0 && boundary.pendingBranch) boundary.resolve()
  }
  queueJob(state.flush)
}

/** @internal Stage updates until every read in this boundary is ready. */
export function commitAsyncRender(
  effect: ReactiveEffect,
  owner: GenericComponentInstance,
  commit: () => void,
  boundary: SuspenseBoundary | null = owner.suspense,
): void {
  trackAsyncRender(effect, boundary)
  if (
    boundary &&
    boundary.asyncRender &&
    boundary.activeBranch &&
    !boundary.pendingBranch &&
    !boundary.isInFallback
  ) {
    const state = getState(boundary)
    cancelAsyncRender(effect)
    state.commits.set(effect, commit)
    queuedBoundaries.set(effect, boundary)
    queueJob(state.flush)
  } else {
    commit()
    cancelAsyncRender(effect)
  }
}
