import {
  type ElementWithTransition,
  type TransitionProps,
  TransitionPropsValidators,
  addTransitionClass,
  forceReflow,
  getTransitionInfo,
  removeTransitionClass,
  resolveTransitionProps,
  vtcKey,
} from './Transition'
import { type VShowElement, vShowHidden } from '../directives/vShow'
import {
  type BaseTransitionProps,
  type ComponentInternalInstance,
  type ComponentOptions,
  DeprecationTypes,
  Fragment,
  type GenericComponentInstance,
  type SetupContext,
  Text,
  type VNode,
  compatUtils,
  createVNode,
  getCurrentInstance,
  getTransitionRawChildren,
  isVaporInteropEnabled,
  onUpdated,
  resolveTransitionHooks,
  setTransitionHooks,
  toRaw,
  useTransitionState,
  warn,
  withTransitionEnabled,
} from '@vue/runtime-core'
import { extend } from '@vue/shared'

interface Position {
  top: number
  left: number
}

// the item of an enclosing group that a nested group is rendered in, sampled
// together with the old positions of the nested group's own children
interface Origin extends Position {
  item: Element
  willMove: () => boolean
}

const positionMap = new WeakMap<VNode, Position>()
const newPositionMap = new WeakMap<VNode, Position>()
const moveCbKey: unique symbol = Symbol('_moveCb')
const enterCbKey = Symbol('_enterCb')
// groups that have updated but not yet run their move, mapped to their root
// and whether they are going to move their children
export const pendingGroups: WeakMap<
  GenericComponentInstance,
  { root: Node; willMove: () => boolean }
> = new WeakMap()

export type TransitionGroupProps = Omit<TransitionProps, 'mode'> & {
  tag?: string
  moveClass?: string
}

/**
 * Wrap logic that modifies TransitionGroup properties in a function
 * so that it can be annotated as pure
 */
const decorate = (t: typeof TransitionGroupImpl) => {
  // TransitionGroup does not support "mode" so we need to remove it from the
  // props declarations, but direct delete operation is considered a side effect
  delete t.props.mode
  if (__COMPAT__) {
    t.__isBuiltIn = true
  }
  return t
}

const TransitionGroupImpl: ComponentOptions = /*@__PURE__*/ decorate({
  name: 'TransitionGroup',

  props: /*@__PURE__*/ extend({}, TransitionPropsValidators, {
    tag: String,
    moveClass: String,
  }),

  setup(props: TransitionGroupProps, { slots }: SetupContext) {
    const instance = getCurrentInstance()!
    const state = useTransitionState()
    // what the rows of a vapor slot child resolve their hooks from
    const group = { props: {} as BaseTransitionProps<Element>, state, instance }
    let prevChildren: VNode[]
    let children: VNode[]
    let origins: Origin[] | undefined
    let moves: boolean | undefined
    // probed lazily: the move class is checked on a child after the patch, and a
    // nested group may need the answer before this group's own updated hook
    const willMove = () => {
      if (moves === undefined) {
        // children is guaranteed to exist after initial render
        moves =
          prevChildren.length > 0 &&
          hasCSSTransform(
            prevChildren[0].el as ElementWithTransition,
            instance.vnode.el as Node,
            resolveMoveClass(props),
          )
      }
      return moves
    }

    onUpdated(() => {
      pendingGroups.delete(instance)
      if (!willMove()) {
        prevChildren = []
        origins = undefined
        return
      }
      const moveClass = resolveMoveClass(props)

      // we divide the work into three loops to avoid mixing DOM reads and writes
      // in each iteration - which helps prevent layout thrashing.
      prevChildren.forEach(vnode => callPendingCbs(vnode.el))
      // between them, the enclosing groups that move animate how far the item
      // this group is rendered in has moved, so that part is left out here. The
      // item is sampled together with this group's children both times, so the
      // two samples stay in the same frame whether or not those groups have
      // already applied their own translations.
      const shift =
        origins && getOriginShift(origins, instance.vnode.el as Node)
      origins = undefined
      prevChildren.forEach(c => recordPosition(c, shift))
      const movedChildren = prevChildren.filter(applyTranslation)

      // force reflow to put everything in position
      forceReflow(instance.vnode.el as Node)

      movedChildren.forEach(c => {
        const el = c.el as ElementWithTransition
        handleMovedChildren(el, moveClass)
      })
      prevChildren = []
    })

    return () => {
      const rawProps = toRaw(props)
      const cssTransitionProps = (group.props =
        resolveTransitionProps(rawProps))
      let tag = rawProps.tag || Fragment

      if (
        __COMPAT__ &&
        !rawProps.tag &&
        compatUtils.checkCompatEnabled(
          DeprecationTypes.TRANSITION_GROUP_ROOT,
          instance.parent as ComponentInternalInstance,
        )
      ) {
        tag = 'span'
      }

      prevChildren = []
      moves = undefined
      if (children) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (
            child.el &&
            child.el instanceof Element &&
            // Hidden v-show nodes have no previous layout box to animate from.
            !(child.el as VShowElement)[vShowHidden]
          ) {
            prevChildren.push(child)
            setTransitionHooks(
              child,
              resolveTransitionHooks(
                child,
                cssTransitionProps,
                state,
                instance,
              ),
            )
            positionMap.set(child, getPosition(child.el as HTMLElement))
          } else if (isVaporInteropEnabled && child.vs && child.vb) {
            // the rows of a mounted vapor slot: hooks refreshed like the
            // children above, positions sampled for the move, which reads
            // only `el`
            instance.appContext.vapor!.forEachGroupChild(child, el => {
              const row = { el } as VNode
              prevChildren.push(row)
              positionMap.set(row, getPosition(el as Element))
            })
          }
        }
      }

      children = slots.default ? getTransitionRawChildren(slots.default()) : []

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isVaporInteropEnabled && child.vs) {
          // the vapor renderer resolves the rows' hooks from the group's
          child.vs.group = group
        } else if (child.key != null) {
          setTransitionHooks(
            child,
            resolveTransitionHooks(child, cssTransitionProps, state, instance),
          )
        } else if (__DEV__ && child.type !== Text) {
          warn(`<TransitionGroup> children must be keyed.`)
        }
      }

      if (prevChildren.length) {
        const root = instance.vnode.el as Node
        origins = getOrigins(instance, root)
        pendingGroups.set(instance, { root, willMove })
      }

      return createVNode(tag, null, children)
    }
  },
})

export const TransitionGroup = /*@__PURE__*/ withTransitionEnabled(
  TransitionGroupImpl,
) as unknown as {
  new (): {
    $props: TransitionGroupProps
  }
}

export function callPendingCbs(el: any): void {
  if (el[moveCbKey]) {
    el[moveCbKey]()
  }
  if (el[enterCbKey]) {
    el[enterCbKey]()
  }
}

function resolveMoveClass(props: TransitionGroupProps): string {
  return props.moveClass || `${props.name || 'v'}-move`
}

function recordPosition(c: VNode, shift?: Position) {
  newPositionMap.set(c, getPosition(c.el as HTMLElement, shift))
}

function applyTranslation(c: VNode): VNode | undefined {
  if (
    baseApplyTranslation(
      positionMap.get(c)!,
      newPositionMap.get(c)!,
      c.el as ElementWithTransition,
    )
  ) {
    return c
  }
}

// shared between vdom and vapor
export function baseApplyTranslation(
  oldPos: Position,
  newPos: Position,
  el: ElementWithTransition,
): boolean {
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    const s = el.style
    const rect = el.getBoundingClientRect()
    let scaleX = 1
    let scaleY = 1
    if (el.offsetWidth) scaleX = rect.width / el.offsetWidth
    if (el.offsetHeight) scaleY = rect.height / el.offsetHeight
    if (!Number.isFinite(scaleX) || scaleX === 0) scaleX = 1
    if (!Number.isFinite(scaleY) || scaleY === 0) scaleY = 1
    // Avoid division noise when scale is effectively 1.
    if (Math.abs(scaleX - 1) < 0.01) scaleX = 1
    if (Math.abs(scaleY - 1) < 0.01) scaleY = 1
    s.transform = s.webkitTransform = `translate(${dx / scaleX}px,${
      dy / scaleY
    }px)`
    s.transitionDuration = '0s'
    return true
  }
  return false
}

export function getPosition(el: Element, shift?: Position): Position {
  const rect = el.getBoundingClientRect()
  return {
    left: rect.left - (shift ? shift.left : 0),
    top: rect.top - (shift ? shift.top : 0),
  }
}

// origins in the enclosing groups that are updating as well, nearest first
export function getOrigins(
  instance: GenericComponentInstance,
  root: Node,
): Origin[] | undefined {
  let origins: Origin[] | undefined
  for (let group = instance.parent; group; group = group.parent) {
    const pending = pendingGroups.get(group)
    if (pending) {
      const item = findItem(pending.root, root)
      if (item) {
        ;(origins || (origins = [])).push(
          extend(getPosition(item), { item, willMove: pending.willMove }),
        )
      }
    }
  }
  return origins
}

// the item of the group rooted at `root` that `node` is rendered in
function findItem(root: Node, node: Node | null): Element | undefined {
  // a group without `tag` renders a fragment, its children share the parent node
  const container = root.nodeType === 1 ? root : root.parentNode
  while (node && node.parentNode !== container) {
    node = node.parentNode
  }
  if (node && node.nodeType === 1) {
    return node as Element
  }
}

// the nearest origin whose group is going to move it: what farther groups
// animate is part of its movement. An item this group's elements have left
// since no longer carries them.
export function getOriginShift(
  origins: Origin[],
  root: Node,
): Position | undefined {
  const origin = origins.find(o => o.willMove() && o.item.contains(root))
  return origin && getPosition(origin.item, origin)
}

// shared between vdom and vapor
export function hasCSSTransform(
  el: ElementWithTransition,
  root: Node,
  moveClass: string,
): boolean {
  // Detect whether an element with the move class applied has
  // CSS transitions. Since the element may be inside an entering
  // transition at this very moment, we make a clone of it and remove
  // all other transition classes applied to ensure only the move class
  // is applied.
  const clone = el.cloneNode() as HTMLElement
  const _vtc = el[vtcKey]
  if (_vtc) {
    _vtc.forEach(cls => {
      cls.split(/\s+/).forEach(c => c && clone.classList.remove(c))
    })
  }
  moveClass.split(/\s+/).forEach(c => c && clone.classList.add(c))
  clone.style.display = 'none'
  const container = (
    root.nodeType === 1 ? root : root.parentNode
  ) as HTMLElement
  container.appendChild(clone)
  const { hasTransform } = getTransitionInfo(clone)
  container.removeChild(clone)
  return hasTransform
}

// shared between vdom and vapor
export const handleMovedChildren = (
  el: ElementWithTransition,
  moveClass: string,
): void => {
  const style = el.style
  addTransitionClass(el, moveClass)
  style.transform = style.webkitTransform = style.transitionDuration = ''
  const cb = ((el as any)[moveCbKey] = (e: TransitionEvent) => {
    if (e && e.target !== el) {
      return
    }
    if (!e || e.propertyName.endsWith('transform')) {
      el.removeEventListener('transitionend', cb)
      ;(el as any)[moveCbKey] = null
      removeTransitionClass(el, moveClass)
    }
  })
  el.addEventListener('transitionend', cb)
}
