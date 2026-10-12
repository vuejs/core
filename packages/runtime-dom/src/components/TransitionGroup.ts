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
  type ComponentInternalInstance,
  type ComponentOptions,
  DeprecationTypes,
  Fragment,
  type SetupContext,
  Text,
  type VNode,
  compatUtils,
  createVNode,
  getCurrentInstance,
  getTransitionRawChildren,
  onUpdated,
  resolveTransitionHooks,
  setTransitionHooks,
  toRaw,
  useTransitionState,
  warn,
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
const moveCbKey = Symbol('_moveCb')
const enterCbKey = Symbol('_enterCb')
// groups that have re-rendered but not yet run their move, mapped to whether
// they are going to move their children
const pendingGroups = new WeakMap<ComponentInternalInstance, () => boolean>()

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
      prevChildren.forEach(callPendingCbs)
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
      })
      prevChildren = []
    })

    return () => {
      const rawProps = toRaw(props)
      const cssTransitionProps = resolveTransitionProps(rawProps)
      let tag = rawProps.tag || Fragment

      if (
        __COMPAT__ &&
        !rawProps.tag &&
        compatUtils.checkCompatEnabled(
          DeprecationTypes.TRANSITION_GROUP_ROOT,
          instance.parent,
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
          }
        }
      }

      children = slots.default ? getTransitionRawChildren(slots.default()) : []

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.key != null) {
          setTransitionHooks(
            child,
            resolveTransitionHooks(child, cssTransitionProps, state, instance),
          )
        } else if (__DEV__ && child.type !== Text) {
          warn(`<TransitionGroup> children must be keyed.`)
        }
      }

      if (prevChildren.length) {
        origins = getOrigins(instance)
        pendingGroups.set(instance, willMove)
      }

      return createVNode(tag, null, children)
    }
  },
})

export const TransitionGroup = TransitionGroupImpl as unknown as {
  new (): {
    $props: TransitionGroupProps
  }
}

function callPendingCbs(c: VNode) {
  const el = c.el as any
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
  const oldPos = positionMap.get(c)!
  const newPos = newPositionMap.get(c)!
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    const el = c.el as HTMLElement
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
    return c
  }
}

function getPosition(el: Element, shift?: Position): Position {
  const rect = el.getBoundingClientRect()
  return {
    left: rect.left - (shift ? shift.left : 0),
    top: rect.top - (shift ? shift.top : 0),
  }
}

// origins in the enclosing groups that are updating as well, nearest first
function getOrigins(instance: ComponentInternalInstance): Origin[] | undefined {
  let origins: Origin[] | undefined
  for (let group = instance.parent; group; group = group.parent) {
    const willMove = pendingGroups.get(group)
    if (willMove) {
      const item = findItem(group.vnode.el as Node, instance.vnode.el as Node)
      if (item) {
        ;(origins || (origins = [])).push(
          extend(getPosition(item), { item, willMove }),
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
function getOriginShift(origins: Origin[], root: Node): Position | undefined {
  const origin = origins.find(o => o.willMove() && o.item.contains(root))
  return origin && getPosition(origin.item, origin)
}

function hasCSSTransform(
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
