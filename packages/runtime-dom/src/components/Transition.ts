import {
  BaseTransition,
  BaseTransitionProps,
  h,
  warn,
  FunctionalComponent,
  getCurrentInstance,
  callWithAsyncErrorHandling
} from '@vue/runtime-core'
import { isObject, toNumber, extend } from '@vue/shared'
import { ErrorCodes } from 'packages/runtime-core/src/errorHandling'

const TRANSITION = 'transition'
const ANIMATION = 'animation'

export interface TransitionProps extends BaseTransitionProps<Element> {
  name?: string
  type?: typeof TRANSITION | typeof ANIMATION
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

// DOM Transition is a higher-order-component based on the platform-agnostic
// base Transition component, with DOM-specific logic.
export const Transition: FunctionalComponent<TransitionProps> = (
  props,
  { slots }
) => h(BaseTransition, resolveTransitionProps(props), slots)

Transition.inheritRef = true

const DOMTransitionPropsValidators = {
  name: String,
  type: String,
  css: {
    type: Boolean,
    default: true
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
  leaveToClass: String
}

export const TransitionPropsValidators = (Transition.props = extend(
  {},
  (BaseTransition as any).props,
  DOMTransitionPropsValidators
))

export function resolveTransitionProps(
  rawProps: TransitionProps
): BaseTransitionProps<Element> {
  let {
    name = 'v',
    type,
    css = true,
    duration,
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    appearFromClass = enterFromClass,
    appearActiveClass = enterActiveClass,
    appearToClass = enterToClass,
    leaveFromClass = `${name}-leave-from`,
    leaveActiveClass = `${name}-leave-active`,
    leaveToClass = `${name}-leave-to`
  } = rawProps

  const baseProps: BaseTransitionProps<Element> = {}
  for (const key in rawProps) {
    if (!(key in DOMTransitionPropsValidators)) {
      ;(baseProps as any)[key] = (rawProps as any)[key]
    }
  }

  if (!css) {
    return baseProps
  }

  const originEnterClass = [enterFromClass, enterActiveClass, enterToClass]
  const instance = getCurrentInstance()!
  const durations = normalizeDuration(duration)
  const enterDuration = durations && durations[0]
  const leaveDuration = durations && durations[1]
  const { appear, onBeforeEnter, onEnter, onLeave } = baseProps

  // is appearing
  if (appear && !instance.isMounted) {
    enterFromClass = appearFromClass
    enterActiveClass = appearActiveClass
    enterToClass = appearToClass
  }

  type Hook = (el: Element, done?: () => void) => void

  const finishEnter: Hook = (el, done) => {
    removeTransitionClass(el, enterToClass)
    removeTransitionClass(el, enterActiveClass)
    done && done()
    // reset enter class
    if (appear) {
      ;[enterFromClass, enterActiveClass, enterToClass] = originEnterClass
    }
  }

  const finishLeave: Hook = (el, done) => {
    removeTransitionClass(el, leaveToClass)
    removeTransitionClass(el, leaveActiveClass)
    done && done()
  }

  // only needed for user hooks called in nextFrame
  // sync errors are already handled by BaseTransition
  function callHookWithErrorHandling(hook: Hook, args: any[]) {
    callWithAsyncErrorHandling(hook, instance, ErrorCodes.TRANSITION_HOOK, args)
  }

  return extend(baseProps, {
    onBeforeEnter(el) {
      onBeforeEnter && onBeforeEnter(el)
      addTransitionClass(el, enterActiveClass)
      addTransitionClass(el, enterFromClass)
    },
    onEnter(el, done) {
      nextFrame(() => {
        const resolve = () => finishEnter(el, done)
        onEnter && callHookWithErrorHandling(onEnter as Hook, [el, resolve])
        removeTransitionClass(el, enterFromClass)
        addTransitionClass(el, enterToClass)
        if (!(onEnter && onEnter.length > 1)) {
          if (enterDuration) {
            setTimeout(resolve, enterDuration)
          } else {
            whenTransitionEnds(el, type, resolve)
          }
        }
      })
    },
    onLeave(el, done) {
      addTransitionClass(el, leaveActiveClass)
      addTransitionClass(el, leaveFromClass)
      nextFrame(() => {
        const resolve = () => finishLeave(el, done)
        onLeave && callHookWithErrorHandling(onLeave as Hook, [el, resolve])
        removeTransitionClass(el, leaveFromClass)
        addTransitionClass(el, leaveToClass)
        if (!(onLeave && onLeave.length > 1)) {
          if (leaveDuration) {
            setTimeout(resolve, leaveDuration)
          } else {
            whenTransitionEnds(el, type, resolve)
          }
        }
      })
    },
    onEnterCancelled: finishEnter,
    onLeaveCancelled: finishLeave
  } as BaseTransitionProps<Element>)
}

function normalizeDuration(
  duration: TransitionProps['duration']
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
  if (__DEV__) validateDuration(res)
  return res
}

function validateDuration(val: unknown) {
  if (typeof val !== 'number') {
    warn(
      `<transition> explicit duration is not a valid number - ` +
        `got ${JSON.stringify(val)}.`
    )
  } else if (isNaN(val)) {
    warn(
      `<transition> explicit duration is NaN - ` +
        'the duration expression might be incorrect.'
    )
  }
}

export interface ElementWithTransition extends HTMLElement {
  // _vtc = Vue Transition Classes.
  // Store the temporarily-added transition classes on the element
  // so that we can avoid overwriting them if the element's class is patched
  // during the transition.
  _vtc?: Set<string>
}

export function addTransitionClass(el: Element, cls: string) {
  cls.split(/\s+/).forEach(c => c && el.classList.add(c))
  ;(
    (el as ElementWithTransition)._vtc ||
    ((el as ElementWithTransition)._vtc = new Set())
  ).add(cls)
}

export function removeTransitionClass(el: Element, cls: string) {
  cls.split(/\s+/).forEach(c => c && el.classList.remove(c))
  const { _vtc } = el as ElementWithTransition
  if (_vtc) {
    _vtc.delete(cls)
    if (!_vtc!.size) {
      ;(el as ElementWithTransition)._vtc = undefined
    }
  }
}

function nextFrame(cb: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb)
  })
}

function whenTransitionEnds(
  el: Element,
  expectedType: TransitionProps['type'] | undefined,
  cb: () => void
) {
  const { type, timeout, propCount } = getTransitionInfo(el, expectedType)
  if (!type) {
    return cb()
  }

  const endEvent = type + 'end'
  let ended = 0
  const end = () => {
    el.removeEventListener(endEvent, onEnd)
    cb()
  }
  const onEnd = (e: Event) => {
    if (e.target === el) {
      if (++ended >= propCount) {
        end()
      }
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
  type: typeof TRANSITION | typeof ANIMATION | null
  propCount: number
  timeout: number
  hasTransform: boolean
}

export function getTransitionInfo(
  el: Element,
  expectedType?: TransitionProps['type']
): CSSTransitionInfo {
  const styles: any = window.getComputedStyle(el)
  // JSDOM may return undefined for transition properties
  const getStyleProperties = (key: string) => (styles[key] || '').split(', ')
  const transitionDelays = getStyleProperties(TRANSITION + 'Delay')
  const transitionDurations = getStyleProperties(TRANSITION + 'Duration')
  const transitionTimeout = getTimeout(transitionDelays, transitionDurations)
  const animationDelays = getStyleProperties(ANIMATION + 'Delay')
  const animationDurations = getStyleProperties(ANIMATION + 'Duration')
  const animationTimeout = getTimeout(animationDelays, animationDurations)

  let type: CSSTransitionInfo['type'] = null
  let timeout = 0
  let propCount = 0
  /* istanbul ignore if */
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
    /\b(transform|all)(,|$)/.test(styles[TRANSITION + 'Property'])
  return {
    type,
    timeout,
    propCount,
    hasTransform
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
  return Number(s.slice(0, -1).replace(',', '.')) * 1000
}
