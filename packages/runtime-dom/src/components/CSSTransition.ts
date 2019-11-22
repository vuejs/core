import {
  Transition as BaseTransition,
  TransitionProps,
  h,
  warn,
  FunctionalComponent
} from '@vue/runtime-core'
import { isObject } from '@vue/shared'

const TRANSITION = 'transition'
const ANIMATION = 'animation'

export interface CSSTransitionProps extends TransitionProps {
  name?: string
  type?: typeof TRANSITION | typeof ANIMATION
  duration?: number | { enter: number; leave: number }
  // custom transition classes
  enterFromClass?: string
  enterActiveClass?: string
  enterToClass?: string
  leaveFromClass?: string
  leaveActiveClass?: string
  leaveToClass?: string
  // if present, indicates this is a v-show transition by toggling the
  // CSS display property instead of actually removing the element.
  show?: boolean
}

export const CSSTransition: FunctionalComponent = (
  props: CSSTransitionProps,
  { slots }
) => h(BaseTransition, resolveCSSTransitionProps(props), slots)

if (__DEV__) {
  CSSTransition.props = {
    ...(BaseTransition as any).props,
    name: String,
    type: String,
    enterClass: String,
    enterActiveClass: String,
    enterToClass: String,
    leaveClass: String,
    leaveActiveClass: String,
    leaveToClass: String,
    duration: Object
  }
}

function resolveCSSTransitionProps({
  name = 'v',
  type,
  duration,
  enterFromClass = `${name}-enter-from`,
  enterActiveClass = `${name}-enter-active`,
  enterToClass = `${name}-enter-to`,
  leaveFromClass = `${name}-leave-from`,
  leaveActiveClass = `${name}-leave-active`,
  leaveToClass = `${name}-leave-to`,
  ...baseProps
}: CSSTransitionProps): TransitionProps {
  const durations = normalizeDuration(duration)
  const enterDuration = durations && durations[0]
  const leaveDuration = durations && durations[1]
  const { onBeforeEnter, onEnter, onLeave } = baseProps

  return {
    ...baseProps,
    onBeforeEnter(el) {
      onBeforeEnter && onBeforeEnter(el)
      addTransitionClass(el, enterActiveClass)
      addTransitionClass(el, enterFromClass)
    },
    onEnter(el, done) {
      nextFrame(() => {
        const resolve = () => {
          removeTransitionClass(el, enterToClass)
          removeTransitionClass(el, enterActiveClass)
          done()
        }
        onEnter && onEnter(el, resolve)
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
        const resolve = () => {
          removeTransitionClass(el, leaveToClass)
          removeTransitionClass(el, leaveActiveClass)
          done()
        }
        onLeave && onLeave(el, resolve)
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
    }
  }
}

function normalizeDuration(
  duration: CSSTransitionProps['duration']
): [number, number] | null {
  if (duration == null) {
    return null
  } else if (isObject(duration)) {
    return [toNumber(duration.enter), toNumber(duration.leave)]
  } else {
    const n = toNumber(duration)
    return [n, n]
  }
}

function toNumber(val: unknown): number {
  const res = Number(val || 0)
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

export interface ElementWithTransition extends Element {
  // _vtc = Vue Transition Classes.
  // Store the temporarily-added transition classes on the element
  // so that we can avoid overwriting them if the element's class is patched
  // during the transition.
  _vtc?: Set<string>
}

function addTransitionClass(el: ElementWithTransition, cls: string) {
  el.classList.add(cls)
  ;(el._vtc || (el._vtc = new Set())).add(cls)
}

function removeTransitionClass(el: ElementWithTransition, cls: string) {
  el.classList.remove(cls)
  el._vtc!.delete(cls)
  if (!el._vtc!.size) {
    el._vtc = undefined
  }
}

function nextFrame(cb: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb)
  })
}

function whenTransitionEnds(
  el: Element,
  expectedType: CSSTransitionProps['type'] | undefined,
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
}

function getTransitionInfo(
  el: Element,
  expectedType?: CSSTransitionProps['type']
): CSSTransitionInfo {
  const styles: any = window.getComputedStyle(el)
  // JSDOM may return undefined for transition properties
  const transitionDelays = (styles[TRANSITION + 'Delay'] || '').split(', ')
  const transitionDurations = (styles[TRANSITION + 'Duration'] || '').split(
    ', '
  )
  const transitionTimeout = getTimeout(transitionDelays, transitionDurations)
  const animationDelays = (styles[ANIMATION + 'Delay'] || '').split(', ')
  const animationDurations = (styles[ANIMATION + 'Duration'] || '').split(', ')
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
  return {
    type,
    timeout,
    propCount
  }
}

function getTimeout(delays: string[], durations: string[]): number {
  while (delays.length < durations.length) {
    delays = delays.concat(delays)
  }
  return Math.max.apply(
    null,
    durations.map((d, i) => {
      return toMs(d) + toMs(delays[i])
    })
  )
}

// Old versions of Chromium (below 61.0.3163.100) formats floating pointer
// numbers in a locale-dependent way, using a comma instead of a dot.
// If comma is not replaced with a dot, the input will be rounded down
// (i.e. acting as a floor function) causing unexpected behaviors
function toMs(s: string): number {
  return Number(s.slice(0, -1).replace(',', '.')) * 1000
}
