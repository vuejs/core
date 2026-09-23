import {
  EMPTY_OBJ,
  type NormalizedStyle,
  camelize,
  canSetValueDirectly,
  getEscapedCssVarName,
  includeBooleanAttr,
  isArray,
  isOn,
  isReservedProp,
  isSpecialBooleanAttr,
  isString,
  isSymbol,
  normalizeClass,
  normalizeCssVarValue,
  normalizeStyle,
  parseStringStyle,
  stringifyStyle,
  toDisplayString,
} from '@vue/shared'
import { onBinding } from './event'
import {
  type GenericComponentInstance,
  MismatchTypes,
  type VShowElement,
  currentInstance,
  getAttributeMismatch,
  isFunctionalFallthroughKey,
  isMapEqual,
  isMismatchAllowed,
  isSetEqual,
  isUnchangedResourceProp,
  isValidHtmlOrSvgAttribute,
  logMismatchError,
  mergeProps,
  parseEventName,
  patchClass,
  patchStyle,
  queuePostFlushCb,
  shouldSetAsProp,
  shouldSetAsPropForVueCE,
  toClassSet,
  toStyleMap,
  unsafeToTrustedHTML,
  vShowHidden,
  vShowOriginalDisplay,
  warn,
  warnPropMismatch,
  xlinkNS,
} from '@vue/runtime-dom'
import {
  type VaporComponentInstance,
  isApplyingFallthroughProps,
  isDeclaredModelListener,
  shouldUseFunctionalFallthrough,
} from '../component'
import {
  isHydrating,
  isRecreatedNode,
  warnHydrationTextMismatch,
} from './hydration'
import { type Block, normalizeBlock } from '../block'
import type { VaporElement } from '../apiDefineCustomElement'
import { isTransitionEnabled } from '../transition'

type TargetElement = Element & {
  $root?: true
  $html?: string
  $cls?: string
  $clsFlags?: number
  $sty?: NormalizedStyle | string | undefined
  value?: string
  _value?: any
}

const shouldSkipFallthroughKey = (el: TargetElement, key: string) => {
  const instance = currentInstance! as VaporComponentInstance
  return (
    !isApplyingFallthroughProps &&
    el.$root &&
    instance.hasFallthrough &&
    instance.type.inheritAttrs !== false &&
    key in instance.attrs &&
    // skip only keys fallthrough will actually write: v-model listeners
    // with a declared prop are filtered out of the fallthrough set
    !isDeclaredModelListener(instance, key) &&
    (!shouldUseFunctionalFallthrough(instance.type) ||
      isFunctionalFallthroughKey(key))
  )
}

export function setProp(el: any, key: string, value: any): void {
  if (key in el) {
    setDOMProp(el, key, value)
  } else {
    setAttr(el, key, value)
  }
}

export function setAttr(
  el: any,
  key: string,
  value: any,
  isSVG: boolean = false,
  forceHydrate: boolean = true,
): void {
  if (shouldSkipFallthroughKey(el, key)) {
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

  if (isHydrating && !isRecreatedNode(el)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      attributeHasMismatch(el, key, value)
    if (skipHydratedWrite(el, key, value, forceHydrate)) {
      el[`$${key}`] = value
      return
    }
  }

  if (value !== el[`$${key}`]) {
    el[`$${key}`] = value
    if (isSVG && key.startsWith('xlink:')) {
      if (value != null) {
        el.setAttributeNS(xlinkNS, key, value)
      } else {
        el.removeAttributeNS(xlinkNS, key.slice(6, key.length))
      }
    } else {
      const isBoolean = isSpecialBooleanAttr(key)
      if (value == null || (isBoolean && !includeBooleanAttr(value))) {
        el.removeAttribute(key)
      } else {
        el.setAttribute(
          key,
          isBoolean ? '' : isSymbol(value) ? String(value) : value,
        )
      }
    }
  }
}

export function setDOMProp(
  el: any,
  key: string,
  value: any,
  // a compiled call is a static key binding, see skipHydratedWrite
  forceHydrate: boolean = true,
  attrName?: string,
): void {
  if (shouldSkipFallthroughKey(el, key)) {
    return
  }

  const cacheKey = `$p$${key}`
  if (isHydrating && !isRecreatedNode(el)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      attributeHasMismatch(el, key, value)
    if (skipHydratedWrite(el, key, value, forceHydrate)) {
      el[cacheKey] = value
      return
    }
  }

  // DOM properties may normalize values differently from reflected attributes,
  // so compare against the previous binding and always perform the initial set.
  if (value === el[cacheKey] && cacheKey in el) {
    return
  }
  el[cacheKey] = value

  let needRemove = false
  if (value === '' || value == null) {
    const type = typeof el[key]
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
  needRemove && el.removeAttribute(attrName || key)
}

export function setClass(
  el: TargetElement,
  value: any,
  isSVG: boolean = false,
  isNormalized: boolean = false,
): void {
  if (el.$clsFlags !== undefined) el.$clsFlags = undefined
  if (el.$root) {
    setClassIncremental(el, value, isNormalized)
  } else {
    if (!isNormalized) value = normalizeClass(value)
    if (isHydrating && !isRecreatedNode(el)) {
      ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
        classHasMismatch(el, value, false)
      el.$cls = value
      return
    }

    if (value !== el.$cls) {
      el.$cls = value
      if (isTransitionEnabled) {
        patchClass(el, value, isSVG)
      } else if (isSVG) {
        el.setAttribute('class', value)
      } else {
        el.className = value
      }
    }
  }
}

export function setClassName(
  el: TargetElement,
  flags: number,
  cls: string | string[],
  prefix: string = '',
  suffix: string = '',
): void {
  // The compiler passes static fragments/prefix/suffix, so flags uniquely
  // identify the rendered class string for this element. Generic setClass()
  // calls clear this cache before writing class through the slower path.
  if (flags === el.$clsFlags) return

  let value = prefix
  if (isString(cls)) {
    if (flags & 1) value += cls
  } else {
    // The compiler caps this at 31 entries because JS bitwise shifts are signed.
    for (let i = 0, bit = 1; i < cls.length; i++, bit <<= 1) {
      if (flags & bit) value += cls[i]
    }
  }
  if (!prefix && value.charCodeAt(0) === 32) {
    value = value.slice(1)
  }
  if (suffix) {
    value = value ? `${value} ${suffix}` : suffix
  }

  if (el.$root || isHydrating) {
    // Root fallthrough and hydration still need the existing setClass;
    // pass the rebuilt string as normalized to avoid doing that work twice.
    setClass(el, value, false, true)
  } else {
    el.$cls = value
    if (isTransitionEnabled) {
      patchClass(el, value, false)
    } else {
      el.className = value
    }
  }
  el.$clsFlags = flags
}

function setClassIncremental(
  el: any,
  value: any,
  isNormalized: boolean = false,
): void {
  const cacheKey = `$clsi${isApplyingFallthroughProps ? '$' : ''}`
  const normalizedValue = isNormalized ? value : normalizeClass(value)

  if (isHydrating && !isRecreatedNode(el)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      classHasMismatch(el, normalizedValue, true)
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

// Defer css-var style mismatch checks until instance.block is set, so root
// ownership can be resolved before adding owner css vars to expected styles.
function shouldDeferCheckStyleMismatch(el: TargetElement): boolean {
  return (
    hasCssVarsInOwnerChain(currentInstance as VaporComponentInstance | null) ||
    hasCssVars((el as HTMLElement).style)
  )
}

function hasCssVarsInOwnerChain(
  instance: VaporComponentInstance | null,
): boolean {
  while (instance) {
    if ((instance as GenericComponentInstance).getCssVars) {
      return true
    }
    instance = instance.parent as VaporComponentInstance | null
  }
  return false
}

function hasCssVars(style: CSSStyleDeclaration): boolean {
  for (let i = 0; i < style.length; i++) {
    if (style.item(i).startsWith('--')) {
      return true
    }
  }
  return false
}

function checkHydrationStyleMismatch(
  el: TargetElement,
  value: any,
  normalizedValue: string | NormalizedStyle | undefined,
  isIncremental: boolean,
): void {
  if (shouldDeferCheckStyleMismatch(el)) {
    const instance = currentInstance as VaporComponentInstance
    queuePostFlushCb(() => {
      styleHasMismatch(el, value, normalizedValue, isIncremental, instance)
    })
  } else {
    styleHasMismatch(el, value, normalizedValue, isIncremental)
  }
}

export function setStyle(el: TargetElement, value: any): void {
  if (el.$root) {
    setStyleIncremental(el, value)
  } else {
    const normalizedValue = normalizeStyle(value)
    if (isHydrating && !isRecreatedNode(el)) {
      if (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) {
        checkHydrationStyleMismatch(el, value, normalizedValue, false)
      }
      el.$sty = normalizedValue
      hydrateVShowDisplay(el, normalizedValue)
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

  if (isHydrating && !isRecreatedNode(el)) {
    if (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) {
      checkHydrationStyleMismatch(el, value, normalizedValue, true)
    }
    el[cacheKey] = normalizedValue
    hydrateVShowDisplay(el, normalizedValue)
    return
  }

  patchStyle(el, el[cacheKey], (el[cacheKey] = normalizedValue))
}

// Hydration skips the style patch, so mirror patchStyle's v-show bookkeeping:
// the client style's display is what v-show restores when shown.
function hydrateVShowDisplay(
  el: Element,
  style: NormalizedStyle | string | undefined,
): void {
  if (vShowOriginalDisplay in el) {
    let display = isString(style)
      ? parseStringStyle(style).display
      : style && style.display
    if (isArray(display)) display = display[display.length - 1]
    ;(el as VShowElement)[vShowOriginalDisplay] =
      display == null ? '' : String(display)
  }
}

export function setValue(
  el: TargetElement,
  value: any,
  forceHydrate: boolean = true,
): void {
  if (shouldSkipFallthroughKey(el, 'value')) {
    return
  }

  // store value as _value as well since
  // non-string values will be stringified.
  el._value = value

  if (isHydrating && !isRecreatedNode(el)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      attributeHasMismatch(
        el,
        'value',
        isString(value) ? getClientText(el, value) : value,
      )
    if (skipHydratedWrite(el, 'value', value, forceHydrate)) {
      return
    }
  }

  // #4956: <option> value will fallback to its text content so we need to
  // compare against its attribute value instead.
  const oldValue = el.tagName === 'OPTION' ? el.getAttribute('value') : el.value
  const newValue = value == null ? '' : value
  if (oldValue !== newValue) {
    el.value = newValue
  }
  // #6007 also set value as an attribute so it works with
  // <input type="reset"> or libs / extensions that expect attributes
  if (value == null) {
    el.removeAttribute('value')
  } else {
    el.setAttribute('value', isSymbol(newValue) ? String(newValue) : newValue)
  }
}

/**
 * Only called on text nodes!
 * Compiler should also ensure value passed here is already converted by
 * `toDisplayString`
 */
export function setText(el: Text & { $txt?: string }, value: string): void {
  if (isHydrating && !isRecreatedNode(el) && !isRecreatedNode(el.parentNode)) {
    const clientText = getClientText(el.parentNode!, value)
    if (el.nodeValue == clientText) {
      el.$txt = clientText
      return
    }

    const parent = el.parentElement
    if (parent && !isMismatchAllowed(parent, MismatchTypes.TEXT)) {
      ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
        warnHydrationTextMismatch(el, value)
      logMismatchError()
    }
  }

  if (el.$txt !== value) {
    el.nodeValue = el.$txt = value
  }
}

/**
 * Used by setDynamicProps and `textContent` bindings, so need to guard with
 * `toDisplayString`
 */
export function setElementText(
  el: Node & { $txt?: string },
  value: unknown,
  forceHydrate: boolean = true,
): void {
  value = toDisplayString(value)
  if (isHydrating && !isRecreatedNode(el)) {
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
    if (skipHydratedWrite(el as Element, 'textContent', value, forceHydrate)) {
      el.$txt = value as string
      return
    }
  }

  if (el.$txt !== value) {
    el.textContent = el.$txt = value as string
  }
}

export function setHtml(
  el: TargetElement,
  value: any,
  forceHydrate: boolean = true,
): void {
  value = value == null ? '' : unsafeToTrustedHTML(value)
  // like vdom, a static key binding replaces the server content during
  // hydration and a spread key keeps it; neither compares nor warns
  if (
    isHydrating &&
    !isRecreatedNode(el) &&
    skipHydratedWrite(el, 'innerHTML', value, forceHydrate)
  ) {
    el.$html = value
    return
  }
  if (el.$html !== value) {
    el.innerHTML = el.$html = value
  }
}

export function setDynamicProps(
  el: any,
  args: any[],
  staticKeys?: string[],
  isSVG?: boolean,
): void {
  patchDynamicProps(
    el,
    args.length > 1 ? mergeProps(...args) : args[0] || EMPTY_OBJ,
    isSVG,
    staticKeys,
  )
}

export function patchDynamicProps(
  el: any,
  props: Record<string, any>,
  isSVG?: boolean,
  staticKeys?: string[],
): void {
  const cacheKey = `$dprops${isApplyingFallthroughProps ? '$' : ''}`
  const prevProps = el[cacheKey] as Record<string, any> | undefined
  const nextProps: Record<string, any> = Object.create(null)

  if (prevProps) {
    for (const key in prevProps) {
      if (!(key in props)) {
        setDynamicProp(el, key, null, isSVG)
      }
    }
  }

  const hydratedKeys = isHydrating ? staticKeys : undefined
  for (const key of Object.keys(props)) {
    if (isReservedProp(key)) continue
    const value = props[key]
    nextProps[key] = value
    // Events and objects can have stable identity with mutable internals, so
    // only skip unchanged primitive values.
    if (
      prevProps &&
      key in prevProps &&
      !isOn(key) &&
      (value == null || typeof value !== 'object') &&
      Object.is(prevProps[key], value)
    ) {
      continue
    }
    setDynamicProp(
      el,
      key,
      value,
      isSVG,
      hydratedKeys && hydratedKeys.includes(key),
    )
  }

  el[cacheKey] = nextProps
}

/**
 * @internal
 */
export function setDynamicProp(
  el: TargetElement,
  key: string,
  value: any,
  isSVG: boolean = false,
  forceHydrate: boolean = false,
): void {
  if (key === 'class') {
    setClass(el, value, isSVG)
  } else if (key === 'style') {
    setStyle(el, value)
  } else if (isOn(key)) {
    if (shouldSkipFallthroughKey(el, key)) {
      return
    }
    const [event, options] = parseEventName(key)
    onBinding(el, event, value, options)
  } else if (
    // force hydrate v-bind with .prop modifiers
    key[0] === '.'
      ? ((key = key.slice(1)), (forceHydrate = true))
      : key[0] === '^'
        ? ((key = key.slice(1)), false)
        : shouldSetAsProp(el, key, value, isSVG)
  ) {
    if (key === 'innerHTML') {
      setHtml(el, value, forceHydrate)
    } else if (key === 'textContent') {
      setElementText(el, value, forceHydrate)
    } else if (key === 'value' && canSetValueDirectly(el.tagName)) {
      setValue(el, value, forceHydrate)
    } else {
      setDOMProp(el, key, value, forceHydrate)
    }
  } else if (
    // #11081 force set props for possible async custom element
    (el as VaporElement)._isVueCE &&
    // #12408 check if it's declared prop or it's async custom element
    (shouldSetAsPropForVueCE(el as VaporElement, key) ||
      // @ts-expect-error _def is private
      ((el as VaporElement)._def.__asyncLoader &&
        (/[A-Z]/.test(key) || !isString(value))))
  ) {
    setDOMProp(el, camelize(key), value, forceHydrate, key)
  } else {
    setAttr(el, key, value, isSVG, forceHydrate)
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
  proto.$evtclick = undefined
  proto.$root = false
  proto.$clsFlags = undefined
  proto.$cls = proto.$sty = ''
  // same reason as $txt below: an empty string would make the first
  // setHtml(el, '') a no-op and leave the original children in place
  proto.$html = undefined
  // Initialize $txt to undefined instead of empty string to ensure setText()
  // properly updates the text node even when the value is empty string.
  // This prevents issues where setText(node, '') would be skipped because
  // $txt === '' would return true, leaving the original nodeValue unchanged.
  ;(Text.prototype as any).$txt = undefined
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
    if (warnPropMismatch(el, 'class', MismatchTypes.CLASS, actual, expected)) {
      logMismatchError()
      return true
    }
  }

  return false
}

function styleHasMismatch(
  el: TargetElement | any,
  value: any,
  normalizedValue: string | NormalizedStyle | undefined,
  isIncremental: boolean,
  instance = currentInstance,
): boolean {
  const actual = el.getAttribute('style')
  const actualStyleMap = toStyleMap(actual || '')
  const expected = isString(value) ? value : stringifyStyle(normalizedValue)
  const expectedStyleMap = toStyleMap(expected)

  // If `v-show=false`, `display: 'none'` should be added to expected
  if (el[vShowHidden]) {
    expectedStyleMap.set('display', 'none')
  }

  // handle css vars
  if (instance) {
    resolveCssVars(instance as VaporComponentInstance, el, expectedStyleMap)
  }

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
    if (warnPropMismatch(el, 'style', MismatchTypes.STYLE, actual, expected)) {
      logMismatchError()
      return true
    }
  }

  return false
}

/**
 * dev only
 */
function resolveCssVars(
  instance: VaporComponentInstance,
  block: Block,
  expectedMap: Map<string, string>,
): void {
  if (!instance.isMounted) return
  const rootBlocks = normalizeBlock(instance)
  if (
    (instance as GenericComponentInstance).getCssVars &&
    normalizeBlock(block).every(b => rootBlocks.includes(b))
  ) {
    const cssVars = (instance as GenericComponentInstance).getCssVars!()
    for (const key in cssVars) {
      const value = normalizeCssVarValue(cssVars[key])
      expectedMap.set(`--${getEscapedCssVarName(key, false)}`, value)
    }
  }

  if (
    normalizeBlock(block).every(b => rootBlocks.includes(b)) &&
    instance.parent
  ) {
    resolveCssVars(
      instance.parent as VaporComponentInstance,
      instance.block,
      expectedMap,
    )
  }
}

function attributeHasMismatch(el: any, key: string, value: any): boolean {
  if (isValidHtmlOrSvgAttribute(el, key)) {
    const { actual, expected } = getAttributeMismatch(el, key, value)
    if (actual !== expected) {
      if (
        warnPropMismatch(el, key, MismatchTypes.ATTRIBUTE, actual, expected)
      ) {
        logMismatchError()
        return true
      }
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

// a compiled call is a static key binding and is written during hydration like
// every key in vdom's dynamicProps; a key setDynamicProp resolves at runtime
// only when it is one of those static keys or the server markup cannot carry
// it. Re-assigning an equal src / href can reload the resource, so an
// unchanged url is adopted as-is.
function skipHydratedWrite(
  el: Element,
  key: string,
  value: any,
  forceHydrate: boolean,
): boolean {
  return (
    (!forceHydrate && !shouldForceHydrate(el, key)) ||
    isUnchangedResourceProp(el, key, value)
  )
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
