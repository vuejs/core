import {
  BaseTransition,
  type BaseTransitionProps,
  BaseTransitionPropsValidators,
  DeprecationTypes,
  type FunctionalComponent,
  assertNumber,
  compatUtils,
  h,
} from '@vue/runtime-core'
import { extend, isArray, isObject, toNumber } from '@vue/shared'

const TRANSITION = 'transition'
const ANIMATION = 'animation'

type AnimationTypes = typeof TRANSITION | typeof ANIMATION

export interface TransitionProps extends BaseTransitionProps<Element> {
  name?: string
  type?: AnimationTypes
  css?: boolean
  duration?: number | { enter: number; leave: number }
  // custom transition classes
  enterFromClass?: string
  enterActiveClass?: string
  enterToClass?: string
  appearFromClass?: string
  appearActiveClass?: string
  appearToClass?: string
  leaveFromClass?: string
  leaveActiveClass?: string
  leaveToClass?: string
}

export const vtcKey: unique symbol = Symbol('_vtc')

export interface ElementWithTransition extends HTMLElement {
  // _vtc = Vue Transition Classes.
  // Store the temporarily-added transition classes on the element
  // so that we can avoid overwriting them if the element's class is patched
  // during the transition.
  [vtcKey]?: Set<string>
}

const DOMTransitionPropsValidators = {
  name: String,
  type: String,
  css: {
    type: Boolean,
    default: true,
  },
  duration: [String, Number, Object],
  enterFromClass: String,
  enterActiveClass: String,
  enterToClass: String,
  appearFromClass: String,
  appearActiveClass: String,
  appearToClass: String,
  leaveFromClass: String,
  leaveActiveClass: String,
  leaveToClass: String,
}

export const TransitionPropsValidators: any = /*@__PURE__*/ extend(
  {},
  BaseTransitionPropsValidators as any,
  DOMTransitionPropsValidators,
)

/**
 * Wrap logic that attaches extra properties to Transition in a function
 * so that it can be annotated as pure
 */
const decorate = (t: typeof Transition) => {
  t.displayName = 'Transition'
  t.props = TransitionPropsValidators
  if (__COMPAT__) {
    t.__isBuiltIn = true
  }
  return t
}

/**
 * DOM Transition is a higher-order-component based on the platform-agnostic
 * base Transition component, with DOM-specific logic.
 */
export const Transition: FunctionalComponent<TransitionProps> =
  /*@__PURE__*/ decorate((props, { slots }) =>
    h(BaseTransition, resolveTransitionProps(props), slots),
  )

/**
 * #3227 Incoming hooks may be merged into arrays when wrapping Transition
 * with custom HOCs.
 */
const callHook = (
  hook: Function | Function[] | undefined,
  args: any[] = [],
) => {
  if (isArray(hook)) {
    hook.forEach(h => h(...args))
  } else if (hook) {
    hook(...args)
  }
}

/**
 * Check if a hook expects a callback (2nd arg), which means the user
 * intends to explicitly control the end of the transition.
 */
const hasExplicitCallback = (
  hook: Function | Function[] | undefined,
): boolean => {
  return hook
    ? isArray(hook)
      ? hook.some(h => h.length > 1)
      : hook.length > 1
    : false
}

export function resolveTransitionProps(
  rawProps: TransitionProps,
): BaseTransitionProps<Element> {
  const baseProps: BaseTransitionProps<Element> = {}
  for (const key in rawProps) {
    if (!(key in DOMTransitionPropsValidators)) {
      ;(baseProps as any)[key] = (rawProps as any)[key]
    }
  }

  if (rawProps.css === false) {
    return baseProps
  }

  const {
    name = 'v',
    type,
    duration,
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    appearFromClass = enterFromClass,
    appearActiveClass = enterActiveClass,
    appearToClass = enterToClass,
    leaveFromClass = `${name}-leave-from`,
    leaveActiveClass = `${name}-leave-active`,
    leaveToClass = `${name}-leave-to`,
  } = rawProps

  // legacy transition class compat
  const legacyClassEnabled =
    __COMPAT__ &&
    compatUtils.isCompatEnabled(DeprecationTypes.TRANSITION_CLASSES, null)
  let legacyEnterFromClass: string
  let legacyAppearFromClass: string
  let legacyLeaveFromClass: string
  if (__COMPAT__ && legacyClassEnabled) {
    const toLegacyClass = (cls: string) => cls.replace(/-from$/, '')
    if (!rawProps.enterFromClass) {
      legacyEnterFromClass = toLegacyClass(enterFromClass)
    }
    if (!rawProps.appearFromClass) {
      legacyAppearFromClass = toLegacyClass(appearFromClass)
    }
    if (!rawProps.leaveFromClass) {
      legacyLeaveFromClass = toLegacyClass(leaveFromClass)
    }
  }

  const durations = normalizeDuration(duration)
  const enterDuration = durations && durations[0]
  const leaveDuration = durations && durations[1]
  const {
    onBeforeEnter,
    onEnter,
    onEnterCancelled,
    onLeave,
    onLeaveCancelled,
    onBeforeAppear = onBeforeEnter,
    onAppear = onEnter,
    onAppearCancelled = onEnterCancelled,
  } = baseProps

  const finishEnter = (
    el: Element & { _enterCancelled?: boolean },
    isAppear: boolean,
    done?: () => void,
    isCancelled?: boolean,
  ) => {
    el._enterCancelled = isCancelled
    removeTransitionClass(el, isAppear ? appearToClass : enterToClass)
    removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass)
    done && done()
  }

  const finishLeave = (
    el: Element & { _isLeaving?: boolean },
    done?: () => void,
  ) => {
    el._isLeaving = false
    removeTransitionClass(el, leaveFromClass)
    removeTransitionClass(el, leaveToClass)
    removeTransitionClass(el, leaveActiveClass)
    done && done()
  }

  const makeEnterHook = (isAppear: boolean) => {
    return (el: Element, done: () => void) => {
      const hook = isAppear ? onAppear : onEnter
      const resolve = () => finishEnter(el, isAppear, done)
      callHook(hook, [el, resolve])
      nextFrame(() => {
        removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass)
        if (__COMPAT__ && legacyClassEnabled) {
          const legacyClass = isAppear
            ? legacyAppearFromClass
            : legacyEnterFromClass
          if (legacyClass) {
            removeTransitionClass(el, legacyClass)
          }
        }
        addTransitionClass(el, isAppear ? appearToClass : enterToClass)
        if (!hasExplicitCallback(hook)) {
          whenTransitionEnds(el, type, enterDuration, resolve)
        }
      })
    }
  }

  return extend(baseProps, {
    onBeforeEnter(el) {
      callHook(onBeforeEnter, [el])
      addTransitionClass(el, enterFromClass)
      if (__COMPAT__ && legacyClassEnabled && legacyEnterFromClass) {
        addTransitionClass(el, legacyEnterFromClass)
      }
      addTransitionClass(el, enterActiveClass)
    },
    onBeforeAppear(el) {
      callHook(onBeforeAppear, [el])
      addTransitionClass(el, appearFromClass)
      if (__COMPAT__ && legacyClassEnabled && legacyAppearFromClass) {
        addTransitionClass(el, legacyAppearFromClass)
      }
      addTransitionClass(el, appearActiveClass)
    },
    onEnter: makeEnterHook(false),
    onAppear: makeEnterHook(true),
    onLeave(
      el: Element & { _isLeaving?: boolean; _enterCancelled?: boolean },
      done,
    ) {
      el._isLeaving = true
      const resolve = () => finishLeave(el, done)
      addTransitionClass(el, leaveFromClass)
      if (__COMPAT__ && legacyClassEnabled && legacyLeaveFromClass) {
        addTransitionClass(el, legacyLeaveFromClass)
      }
      // add *-leave-active class before reflow so in the case of a cancelled enter transition
      // the css will not get the final state (#10677)
      if (!el._enterCancelled) {
        // force reflow so *-leave-from classes immediately take effect (#2593)
        forceReflow()
        addTransitionClass(el, leaveActiveClass)
      } else {
        addTransitionClass(el, leaveActiveClass)
        forceReflow()
      }
      nextFrame(() => {
        if (!el._isLeaving) {
          // cancelled
          return
        }
        removeTransitionClass(el, leaveFromClass)
        if (__COMPAT__ && legacyClassEnabled && legacyLeaveFromClass) {
          removeTransitionClass(el, legacyLeaveFromClass)
        }
        addTransitionClass(el, leaveToClass)
        if (!hasExplicitCallback(onLeave)) {
          whenTransitionEnds(el, type, leaveDuration, resolve)
        }
      })
      callHook(onLeave, [el, resolve])
    },
    onEnterCancelled(el) {
      finishEnter(el, false, undefined, true)
      callHook(onEnterCancelled, [el])
    },
    onAppearCancelled(el) {
      finishEnter(el, true, undefined, true)
      callHook(onAppearCancelled, [el])
    },
    onLeaveCancelled(el) {
      finishLeave(el)
      callHook(onLeaveCancelled, [el])
    },
  } as BaseTransitionProps<Element>)
}

function normalizeDuration(
  duration: TransitionProps['duration'],
): [number, number] | null {
  if (duration == null) {
    return null
  } else if (isObject(duration)) {
    return [NumberOf(duration.enter), NumberOf(duration.leave)]
  } else {
    const n = NumberOf(duration)
    return [n, n]
  }
}

function NumberOf(val: unknown): number {
  const res = toNumber(val)
  if (__DEV__) {
    assertNumber(res, '<transition> explicit duration')
  }
  return res
}

export function addTransitionClass(el: Element, cls: string): void {
  cls.split(/\s+/).forEach(c => c && el.classList.add(c))
  ;(
    (el as ElementWithTransition)[vtcKey] ||
    ((el as ElementWithTransition)[vtcKey] = new Set())
  ).add(cls)
}

export function removeTransitionClass(el: Element, cls: string): void {
  cls.split(/\s+/).forEach(c => c && el.classList.remove(c))
  const _vtc = (el as ElementWithTransition)[vtcKey]
  if (_vtc) {
    _vtc.delete(cls)
    if (!_vtc!.size) {
      ;(el as ElementWithTransition)[vtcKey] = undefined
    }
  }
}

function nextFrame(cb: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb)
  })
}

let endId = 0

function whenTransitionEnds(
  el: Element & { _endId?: number },
  expectedType: TransitionProps['type'] | undefined,
  explicitTimeout: number | null,
  resolve: () => void,
) {
  const id = (el._endId = ++endId)
  const resolveIfNotStale = () => {
    if (id === el._endId) {
      resolve()
    }
  }

  if (explicitTimeout != null) {
    return setTimeout(resolveIfNotStale, explicitTimeout)
  }

  const { type, timeout, propCount } = getTransitionInfo(el, expectedType)
  if (!type) {
    return resolve()
  }

  const endEvent = type + 'end'
  let ended = 0
  const end = () => {
    el.removeEventListener(endEvent, onEnd)
    resolveIfNotStale()
  }
  const onEnd = (e: Event) => {
    if (e.target === el && ++ended >= propCount) {
      end()
    }
  }
  setTimeout(() => {
    if (ended < propCount) {
      end()
    }
  }, timeout + 1)
  el.addEventListener(endEvent, onEnd)
}

interface CSSTransitionInfo {
  type: AnimationTypes | null
  propCount: number
  timeout: number
  hasTransform: boolean
}

type AnimationProperties = 'Delay' | 'Duration'
type StylePropertiesKey =
  | `${AnimationTypes}${AnimationProperties}`
  | `${typeof TRANSITION}Property`

export function getTransitionInfo(
  el: Element,
  expectedType?: TransitionProps['type'],
): CSSTransitionInfo {
  const styles = window.getComputedStyle(el) as Pick<
    CSSStyleDeclaration,
    StylePropertiesKey
  >
  // JSDOM may return undefined for transition properties
  const getStyleProperties = (key: StylePropertiesKey) =>
    (styles[key] || '').split(', ')
  const transitionDelays = getStyleProperties(`${TRANSITION}Delay`)
  const transitionDurations = getStyleProperties(`${TRANSITION}Duration`)
  const transitionTimeout = getTimeout(transitionDelays, transitionDurations)
  const animationDelays = getStyleProperties(`${ANIMATION}Delay`)
  const animationDurations = getStyleProperties(`${ANIMATION}Duration`)
  const animationTimeout = getTimeout(animationDelays, animationDurations)

  let type: CSSTransitionInfo['type'] = null
  let timeout = 0
  let propCount = 0
  if (expectedType === TRANSITION) {
    if (transitionTimeout > 0) {
      type = TRANSITION
      timeout = transitionTimeout
      propCount = transitionDurations.length
    }
  } else if (expectedType === ANIMATION) {
    if (animationTimeout > 0) {
      type = ANIMATION
      timeout = animationTimeout
      propCount = animationDurations.length
    }
  } else {
    timeout = Math.max(transitionTimeout, animationTimeout)
    type =
      timeout > 0
        ? transitionTimeout > animationTimeout
          ? TRANSITION
          : ANIMATION
        : null
    propCount = type
      ? type === TRANSITION
        ? transitionDurations.length
        : animationDurations.length
      : 0
  }
  const hasTransform =
    type === TRANSITION &&
    /\b(transform|all)(,|$)/.test(
      getStyleProperties(`${TRANSITION}Property`).toString(),
    )
  return {
    type,
    timeout,
    propCount,
    hasTransform,
  }
}

function getTimeout(delays: string[], durations: string[]): number {
  while (delays.length < durations.length) {
    delays = delays.concat(delays)
  }
  return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])))
}

// Old versions of Chromium (below 61.0.3163.100) formats floating pointer
// numbers in a locale-dependent way, using a comma instead of a dot.
// If comma is not replaced with a dot, the input will be rounded down
// (i.e. acting as a floor function) causing unexpected behaviors
function toMs(s: string): number {
  // #8409 default value for CSS durations can be 'auto'
  if (s === 'auto') return 0
  return Number(s.slice(0, -1).replace(',', '.')) * 1000
}

// synchronously force layout to put elements into a certain state
export function forceReflow(): number {
  return document.body.offsetHeight
}
