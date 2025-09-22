import {
  type NormalizedStyle,
  canSetValueDirectly,
  isOn,
  isString,
  normalizeClass,
  normalizeStyle,
  parseStringStyle,
  stringifyStyle,
  toDisplayString,
} from '@vue/shared'
import { on } from './event'
import {
  MismatchTypes,
  currentInstance,
  getAttributeMismatch,
  isMapEqual,
  isMismatchAllowed,
  isSetEqual,
  isValidHtmlOrSvgAttribute,
  mergeProps,
  patchStyle,
  shouldSetAsProp,
  toClassSet,
  toStyleMap,
  vShowHidden,
  warn,
  warnPropMismatch,
} from '@vue/runtime-dom'
import {
  type VaporComponentInstance,
  isApplyingFallthroughProps,
} from '../component'
import { isHydrating, logMismatchError } from './hydration'

type TargetElement = Element & {
  $root?: true
  $html?: string
  $cls?: string
  $sty?: NormalizedStyle | string | undefined
  value?: string
  _value?: any
}

const hasFallthroughKey = (key: string) =>
  (currentInstance as VaporComponentInstance).hasFallthrough &&
  key in currentInstance!.attrs

export function setProp(el: any, key: string, value: any): void {
  if (key in el) {
    setDOMProp(el, key, value)
  } else {
    setAttr(el, key, value)
  }
}

export function setAttr(el: any, key: string, value: any): void {
  if (!isApplyingFallthroughProps && el.$root && hasFallthroughKey(key)) {
    return
  }

  // special case for <input v-model type="checkbox"> with
  // :true-value & :false-value
  // store value as dom properties since non-string values will be
  // stringified.
  if (key === 'true-value') {
    ;(el as any)._trueValue = value
  } else if (key === 'false-value') {
    ;(el as any)._falseValue = value
  }

  if (
    (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
    isHydrating &&
    !attributeHasMismatch(el, key, value)
  ) {
    el[`$${key}`] = value
    return
  }

  if (value !== el[`$${key}`]) {
    el[`$${key}`] = value
    if (value != null) {
      el.setAttribute(key, value)
    } else {
      el.removeAttribute(key)
    }
  }
}

export function setDOMProp(el: any, key: string, value: any): void {
  if (!isApplyingFallthroughProps && el.$root && hasFallthroughKey(key)) {
    return
  }

  if (
    (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
    isHydrating &&
    !attributeHasMismatch(el, key, value)
  ) {
    return
  }

  const prev = el[key]
  if (value === prev) {
    return
  }

  let needRemove = false
  if (value === '' || value == null) {
    const type = typeof prev
    if (value == null && type === 'string') {
      // e.g. <div :id="null">
      value = ''
      needRemove = true
    } else if (type === 'number') {
      // e.g. <img :width="null">
      value = 0
      needRemove = true
    }
  }

  // some properties perform value validation and throw,
  // some properties has getter, no setter, will error in 'use strict'
  // eg. <select :type="null"></select> <select :willValidate="null"></select>
  try {
    el[key] = value
  } catch (e: any) {
    // do not warn if value is auto-coerced from nullish values
    if (__DEV__ && !needRemove) {
      warn(
        `Failed setting prop "${key}" on <${el.tagName.toLowerCase()}>: ` +
          `value ${value} is invalid.`,
        e,
      )
    }
  }
  needRemove && el.removeAttribute(key)
}

export function setClass(el: TargetElement, value: any): void {
  if (el.$root) {
    setClassIncremental(el, value)
  } else {
    value = normalizeClass(value)
    if (
      (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      isHydrating &&
      !classHasMismatch(el, value, false)
    ) {
      el.$cls = value
      return
    }

    if (value !== el.$cls) {
      el.className = el.$cls = value
    }
  }
}

function setClassIncremental(el: any, value: any): void {
  const cacheKey = `$clsi${isApplyingFallthroughProps ? '$' : ''}`
  const normalizedValue = normalizeClass(value)

  if (
    (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
    isHydrating &&
    !classHasMismatch(el, normalizedValue, true)
  ) {
    el[cacheKey] = normalizedValue
    return
  }

  const prev = el[cacheKey]
  if ((value = el[cacheKey] = normalizedValue) !== prev) {
    const nextList = value.split(/\s+/)
    if (value) {
      el.classList.add(...nextList)
    }
    if (prev) {
      for (const cls of prev.split(/\s+/)) {
        if (!nextList.includes(cls)) el.classList.remove(cls)
      }
    }
  }
}

export function setStyle(el: TargetElement, value: any): void {
  if (el.$root) {
    setStyleIncremental(el, value)
  } else {
    const normalizedValue = normalizeStyle(value)
    if (
      (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      isHydrating &&
      !styleHasMismatch(el, value, normalizedValue, false)
    ) {
      el.$sty = normalizedValue
      return
    }

    patchStyle(el, el.$sty, (el.$sty = normalizedValue))
  }
}

function setStyleIncremental(el: any, value: any): NormalizedStyle | undefined {
  const cacheKey = `$styi${isApplyingFallthroughProps ? '$' : ''}`
  const normalizedValue = isString(value)
    ? parseStringStyle(value)
    : (normalizeStyle(value) as NormalizedStyle | undefined)

  if (
    (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
    isHydrating &&
    !styleHasMismatch(el, value, normalizedValue, true)
  ) {
    el[cacheKey] = normalizedValue
    return
  }

  patchStyle(el, el[cacheKey], (el[cacheKey] = normalizedValue))
}

export function setValue(el: TargetElement, value: any): void {
  if (!isApplyingFallthroughProps && el.$root && hasFallthroughKey('value')) {
    return
  }

  // store value as _value as well since
  // non-string values will be stringified.
  el._value = value

  if (
    (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
    isHydrating &&
    !attributeHasMismatch(el, 'value', getClientText(el, value))
  ) {
    return
  }

  // #4956: <option> value will fallback to its text content so we need to
  // compare against its attribute value instead.
  const oldValue = el.tagName === 'OPTION' ? el.getAttribute('value') : el.value
  const newValue = value == null ? '' : value
  if (oldValue !== newValue) {
    el.value = newValue
  }
  if (value == null) {
    el.removeAttribute('value')
  }
}

/**
 * Only called on text nodes!
 * Compiler should also ensure value passed here is already converted by
 * `toDisplayString`
 */
export function setText(el: Text & { $txt?: string }, value: string): void {
  if (isHydrating) {
    const clientText = getClientText(el.parentNode!, value)
    if (el.nodeValue == clientText) {
      el.$txt = clientText
      return
    }

    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      warn(
        `Hydration text mismatch in`,
        el.parentNode,
        `\n  - rendered on server: ${JSON.stringify((el as Text).data)}` +
          `\n  - expected on client: ${JSON.stringify(value)}`,
      )
    logMismatchError()
  }

  if (el.$txt !== value) {
    el.nodeValue = el.$txt = value
  }
}

/**
 * Used by setDynamicProps only, so need to guard with `toDisplayString`
 */
export function setElementText(
  el: Node & { $txt?: string },
  value: unknown,
): void {
  value = toDisplayString(value)
  if (isHydrating) {
    let clientText = getClientText(el, value as string)
    if (el.textContent === clientText) {
      el.$txt = clientText
      return
    }

    if (!isMismatchAllowed(el as Element, MismatchTypes.TEXT)) {
      ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
        warn(
          `Hydration text content mismatch on`,
          el,
          `\n  - rendered on server: ${el.textContent}` +
            `\n  - expected on client: ${clientText}`,
        )
      logMismatchError()
    }
  }

  if (el.$txt !== value) {
    el.textContent = el.$txt = value as string
  }
}

export function setHtml(el: TargetElement, value: any): void {
  value = value == null ? '' : value

  if (isHydrating) {
    if (el.innerHTML === value) {
      el.$html = value
      return
    }

    if (!isMismatchAllowed(el, MismatchTypes.CHILDREN)) {
      if (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) {
        warn(
          `Hydration children mismatch on`,
          el,
          `\nServer rendered element contains different child nodes from client nodes.`,
        )
      }
      logMismatchError()
    }
  }

  if (el.$html !== value) {
    el.innerHTML = el.$html = value
  }
}

export function setDynamicProps(el: any, args: any[]): void {
  const props = args.length > 1 ? mergeProps(...args) : args[0]
  const cacheKey = `$dprops${isApplyingFallthroughProps ? '$' : ''}`
  const prevKeys = el[cacheKey] as string[]

  if (prevKeys) {
    for (const key of prevKeys) {
      if (!(key in props)) {
        setDynamicProp(el, key, null)
      }
    }
  }

  for (const key of (el[cacheKey] = Object.keys(props))) {
    setDynamicProp(el, key, props[key])
  }
}

/**
 * @internal
 */
export function setDynamicProp(
  el: TargetElement,
  key: string,
  value: any,
): void {
  // TODO
  const isSVG = false
  if (key === 'class') {
    setClass(el, value)
  } else if (key === 'style') {
    setStyle(el, value)
  } else if (isOn(key)) {
    on(el, key[2].toLowerCase() + key.slice(3), value, { effect: true })
  } else if (
    key[0] === '.'
      ? ((key = key.slice(1)), true)
      : key[0] === '^'
        ? ((key = key.slice(1)), false)
        : shouldSetAsProp(el, key, value, isSVG)
  ) {
    if (key === 'innerHTML') {
      setHtml(el, value)
    } else if (key === 'textContent') {
      setElementText(el, value)
    } else if (key === 'value' && canSetValueDirectly(el.tagName)) {
      setValue(el, value)
    } else {
      setDOMProp(el, key, value)
    }
  } else {
    // TODO special case for <input v-model type="checkbox">
    setAttr(el, key, value)
  }
  return value
}

let isOptimized = false

/**
 * Optimize property lookup for cache properties on Element and Text nodes
 */
export function optimizePropertyLookup(): void {
  if (isOptimized) return
  isOptimized = true
  const proto = Element.prototype as any
  proto.$evtclick = undefined
  proto.$children = undefined
  proto.$idx = undefined
  proto.$root = false
  proto.$html =
    proto.$txt =
    proto.$cls =
    proto.$sty =
    (Text.prototype as any).$txt =
      ''
}

function classHasMismatch(
  el: TargetElement | any,
  expected: string,
  isIncremental: boolean,
): boolean {
  const actual = el.getAttribute('class')
  const actualClassSet = toClassSet(actual || '')
  const expectedClassSet = toClassSet(expected)

  const hasMismatch = isIncremental
    ? // check if the expected classes are present in the actual classes
      Array.from(expectedClassSet).some(cls => !actualClassSet.has(cls))
    : !isSetEqual(actualClassSet, expectedClassSet)

  if (hasMismatch) {
    warnPropMismatch(el, 'class', MismatchTypes.CLASS, actual, expected)
    logMismatchError()
    return true
  }

  return false
}

function styleHasMismatch(
  el: TargetElement | any,
  value: any,
  normalizedValue: string | NormalizedStyle | undefined,
  isIncremental: boolean,
): boolean {
  const actual = el.getAttribute('style')
  const actualStyleMap = toStyleMap(actual || '')
  const expected = isString(value) ? value : stringifyStyle(normalizedValue)
  const expectedStyleMap = toStyleMap(expected)

  // If `v-show=false`, `display: 'none'` should be added to expected
  if (el[vShowHidden]) {
    expectedStyleMap.set('display', 'none')
  }

  // TODO: handle css vars

  const hasMismatch = isIncremental
    ? // check if the expected styles are present in the actual styles
      Array.from(expectedStyleMap.entries()).some(
        ([key, val]) => actualStyleMap.get(key) !== val,
      )
    : !isMapEqual(actualStyleMap, expectedStyleMap)

  if (hasMismatch) {
    warnPropMismatch(el, 'style', MismatchTypes.STYLE, actual, expected)
    logMismatchError()
    return true
  }

  return false
}

function attributeHasMismatch(el: any, key: string, value: any): boolean {
  if (isValidHtmlOrSvgAttribute(el, key)) {
    const { actual, expected } = getAttributeMismatch(el, key, value)
    if (actual !== expected) {
      warnPropMismatch(el, key, MismatchTypes.ATTRIBUTE, actual, expected)
      logMismatchError()
      return true
    }
  }
  return false
}

function getClientText(el: Node, value: string): string {
  if (
    value[0] === '\n' &&
    ((el as Element).tagName === 'PRE' ||
      (el as Element).tagName === 'TEXTAREA')
  ) {
    value = value.slice(1)
  }
  return value
}
