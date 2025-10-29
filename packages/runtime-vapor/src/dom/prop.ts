import {
  type NormalizedStyle,
  canSetValueDirectly,
  includeBooleanAttr,
  isArray,
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
  unsafeToTrustedHTML,
  vShowHidden,
  warn,
  warnPropMismatch,
} from '@vue/runtime-dom'
import {
  type VaporComponentInstance,
  isApplyingFallthroughProps,
  isVaporComponent,
} from '../component'
import { isHydrating, logMismatchError } from './hydration'
import type { Block } from '../block'

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

export function setDOMProp(
  el: any,
  key: string,
  value: any,
  forceHydrate: boolean = false,
): void {
  if (!isApplyingFallthroughProps && el.$root && hasFallthroughKey(key)) {
    return
  }

  if (
    (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
    isHydrating &&
    !attributeHasMismatch(el, key, value) &&
    !shouldForceHydrate(el, key) &&
    !forceHydrate
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
    if (type === 'boolean') {
      value = includeBooleanAttr(value)
    } else if (value == null && type === 'string') {
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

export function setValue(
  el: TargetElement,
  value: any,
  forceHydrate: boolean = false,
): void {
  if (!isApplyingFallthroughProps && el.$root && hasFallthroughKey('value')) {
    return
  }

  // store value as _value as well since
  // non-string values will be stringified.
  el._value = value

  if (
    (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
    isHydrating &&
    !attributeHasMismatch(el, 'value', getClientText(el, value)) &&
    !shouldForceHydrate(el, 'value') &&
    !forceHydrate
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

export function setBlockText(
  block: Block & { $txt?: string },
  value: unknown,
): void {
  value = value == null ? '' : value
  if (block.$txt !== value) {
    setTextToBlock(block, (block.$txt = value as string))
  }
}

/**
 * dev only
 */
function warnCannotSetProp(prop: string): void {
  warn(
    `Extraneous non-props attributes (` +
      `${prop}) ` +
      `were passed to component but could not be automatically inherited ` +
      `because component renders text or multiple root nodes.`,
  )
}

function setTextToBlock(block: Block, value: any): void {
  if (block instanceof Node) {
    if (block instanceof Element) {
      block.textContent = value
    } else if (__DEV__) {
      warnCannotSetProp('textContent')
    }
  } else if (isVaporComponent(block)) {
    setTextToBlock(block.block, value)
  } else if (isArray(block)) {
    if (__DEV__) {
      warnCannotSetProp('textContent')
    }
  } else {
    setTextToBlock(block.nodes, value)
  }
}

export function setHtml(el: TargetElement, value: any): void {
  value = value == null ? '' : unsafeToTrustedHTML(value)
  if (el.$html !== value) {
    el.innerHTML = el.$html = value
  }
}

export function setBlockHtml(
  block: Block & { $html?: string },
  value: any,
): void {
  value = value == null ? '' : unsafeToTrustedHTML(value)
  if (block.$html !== value) {
    setHtmlToBlock(block, (block.$html = value))
  }
}

function setHtmlToBlock(block: Block, value: any): void {
  if (block instanceof Node) {
    if (block instanceof Element) {
      block.innerHTML = value
    } else if (__DEV__) {
      warnCannotSetProp('innerHTML')
    }
  } else if (isVaporComponent(block)) {
    setHtmlToBlock(block.block, value)
  } else if (isArray(block)) {
    if (__DEV__) {
      warnCannotSetProp('innerHTML')
    }
  } else {
    setHtmlToBlock(block.nodes, value)
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
  let forceHydrate = false
  if (key === 'class') {
    setClass(el, value)
  } else if (key === 'style') {
    setStyle(el, value)
  } else if (isOn(key)) {
    on(el, key[2].toLowerCase() + key.slice(3), value, { effect: true })
  } else if (
    // force hydrate v-bind with .prop modifiers
    (forceHydrate = key[0] === '.')
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
      setValue(el, value, forceHydrate)
    } else {
      setDOMProp(el, key, value, forceHydrate)
    }
  } else {
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
  proto.$transition = undefined
  proto.$key = undefined
  proto.$fc = proto.$evtclick = undefined
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

  let hasMismatch: boolean = false
  if (isIncremental) {
    if (expected) {
      hasMismatch = Array.from(expectedClassSet).some(
        cls => !actualClassSet.has(cls),
      )
    }
  } else {
    hasMismatch = !isSetEqual(actualClassSet, expectedClassSet)
  }

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

  let hasMismatch: boolean = false
  if (isIncremental) {
    if (expected) {
      // check if the expected styles are present in the actual styles
      hasMismatch = Array.from(expectedStyleMap.entries()).some(
        ([key, val]) => actualStyleMap.get(key) !== val,
      )
    }
  } else {
    hasMismatch = !isMapEqual(actualStyleMap, expectedStyleMap)
  }

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

function shouldForceHydrate(el: Element, key: string): boolean {
  const { tagName } = el
  return (
    ((tagName === 'INPUT' || tagName === 'OPTION') &&
      (key.endsWith('value') || key === 'indeterminate')) ||
    // force hydrate custom element dynamic props
    tagName.includes('-')
  )
}
