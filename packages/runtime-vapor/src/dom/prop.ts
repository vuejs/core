import {
  EMPTY_OBJ,
  type NormalizedStyle,
  camelize,
  canSetValueDirectly,
  getEscapedCssVarName,
  hasOwn,
  includeBooleanAttr,
  isOn,
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
import { onBinding, onRootBinding } from './event'
import {
  type GenericComponentInstance,
  MismatchTypes,
  currentInstance,
  getAttributeMismatch,
  isMapEqual,
  isMismatchAllowed,
  isSetEqual,
  isValidHtmlOrSvgAttribute,
  logMismatchError,
  mergeProps,
  parseEventName,
  patchStyle,
  queuePostFlushCb,
  shouldSetAsProp,
  shouldSetAsPropForVueCE,
  toClassSet,
  toStyleMap,
  unsafeToTrustedHTML,
  vModelGetValue,
  vShowHidden,
  vShowOriginalDisplay,
  warn,
  warnPropMismatch,
  xlinkNS,
} from '@vue/runtime-dom'
import {
  type VaporComponentInstance,
  forwardsFallthroughAttrs,
  isApplyingFallthroughProps,
} from '../component'
import {
  isHydrating,
  isRecreatedNode,
  warnHydrationTextMismatch,
} from './hydration'
import { type Block, normalizeBlock } from '../block'
import type { VaporElement } from '../apiDefineCustomElement'

type TargetElement = Element & {
  // Inherited dynamic props currently applied through attrs fallthrough.
  $dprops$?: Record<string, any>
  // Latest local root props shadowed by fallthrough, restored on removal.
  $lprops?: Record<string, LocalRootProp>
  $root?: true
  $html?: string
  $cls?: string
  $clsFlags?: number
  // Local ($clsi/$styi) and inherited ($clsi$/$styi$) incremental caches.
  $clsi?: string
  $clsi$?: string
  $styi?: NormalizedStyle
  $styi$?: NormalizedStyle
  $sty?: NormalizedStyle | string | undefined
  value?: string
  _value?: any
}

const enum LocalPropType {
  ATTR,
  DOM_PROP,
  VALUE,
}

type LocalRootProp = [
  type: LocalPropType,
  value: any,
  extra?: any,
  removeAttr?: boolean,
]

function recordShadowedRootProp(
  el: TargetElement,
  key: string,
  type: LocalPropType,
  value: any,
  extra?: any,
): boolean {
  const inherited = el.$dprops$
  if (!isApplyingFallthroughProps && inherited && key in inherited) {
    ;(el.$lprops || (el.$lprops = Object.create(null)))[key] = [
      type,
      value,
      extra,
    ]
    return true
  }
  return false
}

// Keys whose local value flows through setAttr/setDOMProp/setValue — the
// setters restoreLocalRootProp replays through. class/style/events merge
// local and inherited values instead of shadowing.
function isRestorableDynamicProp(key: string): boolean {
  return (
    key[0] !== '.' &&
    key[0] !== '^' &&
    key !== 'class' &&
    key !== 'style' &&
    !isOn(key) &&
    key !== 'innerHTML' &&
    key !== 'textContent'
  )
}

function captureLocalRootProp(
  el: TargetElement,
  key: string,
  isSVG: boolean,
): void {
  const local = el.$lprops || (el.$lprops = Object.create(null))
  if (key in local) return

  if (key === 'value' && canSetValueDirectly(el.tagName)) {
    local[key] = [LocalPropType.VALUE, vModelGetValue(el as any)]
  } else if (hasOwn(el, `$${key}`)) {
    local[key] = [LocalPropType.ATTR, (el as any)[`$${key}`], isSVG]
  } else if (el.hasAttribute(key)) {
    local[key] = [LocalPropType.ATTR, el.getAttribute(key), isSVG]
  } else if (key in el) {
    local[key] = [LocalPropType.DOM_PROP, (el as any)[key], undefined, true]
  } else {
    local[key] = [LocalPropType.ATTR, null, isSVG]
  }
}

function restoreLocalRootProp(el: TargetElement, key: string): boolean {
  const local = el.$lprops
  const entry = local && local[key]
  if (!entry) return false

  delete local[key]
  if (entry[0] === LocalPropType.ATTR) {
    setAttr(el, key, entry[1], entry[2])
  } else if (entry[0] === LocalPropType.DOM_PROP) {
    setDOMProp(el, key, entry[1], false, entry[2])
    if (entry[3]) el.removeAttribute(key)
  } else {
    setValue(el, entry[1])
  }
  return true
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
): void {
  if (recordShadowedRootProp(el, key, LocalPropType.ATTR, value, isSVG)) {
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
    el[`$${key}`] = value
    return
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
  forceHydrate: boolean = false,
  attrName?: string,
): void {
  if (
    recordShadowedRootProp(el, key, LocalPropType.DOM_PROP, value, attrName)
  ) {
    return
  }

  if (isHydrating && !isRecreatedNode(el)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      attributeHasMismatch(el, key, value)
    if (!forceHydrate && !shouldForceHydrate(el, key)) {
      return
    }
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
      if (isSVG) {
        el.setAttribute('class', (el.$cls = value))
      } else {
        el.className = el.$cls = value
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
    el.className = el.$cls = value
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
      const other = isApplyingFallthroughProps ? el.$clsi : el.$clsi$
      let otherList: string[] | undefined
      for (const cls of prev.split(/\s+/)) {
        if (
          !nextList.includes(cls) &&
          !(other && (otherList ||= other.split(/\s+/)).includes(cls))
        ) {
          el.classList.remove(cls)
        }
      }
    }
  }
}

// Record the classes the element carried before fallthrough first applied
// (static template classes) so incremental removal keeps them.
function seedLocalClass(el: TargetElement): void {
  if (el.$clsi === undefined) {
    el.$clsi = normalizeClass(el.getAttribute('class'))
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
      return
    }

    patchStyle(el, el.$sty, (el.$sty = normalizedValue))
  }
}

function setStyleIncremental(el: any, value: any): void {
  const cacheKey = `$styi${isApplyingFallthroughProps ? '$' : ''}`
  const prev = el[cacheKey]
  const normalizedValue = isString(value)
    ? parseStringStyle(value)
    : (normalizeStyle(value) as NormalizedStyle | undefined)
  el[cacheKey] = normalizedValue

  if (isHydrating && !isRecreatedNode(el)) {
    if (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) {
      checkHydrationStyleMismatch(el, value, normalizedValue, true)
    }
    return
  }

  if (!isApplyingFallthroughProps && el.$styi$ === undefined) {
    patchStyle(el, prev, normalizedValue)
    return
  }

  const next = normalizeStyle([el.$styi, el.$styi$]) as NormalizedStyle
  patchStyle(el, el.$sty, (el.$sty = next))
}

// Record the styles the element carried before fallthrough first applied
// (static template styles) so they participate in cache merging. The live
// display value belongs to v-show when present, so seed the author's
// display from the directive's own record instead.
function seedLocalStyle(el: TargetElement): void {
  if (el.$styi !== undefined) return
  const style = el.getAttribute('style')
  const parsed = style ? parseStringStyle(style) : undefined
  if (parsed && vShowOriginalDisplay in el) {
    const display = (el as any)[vShowOriginalDisplay]
    if (display) parsed.display = display
    else delete parsed.display
  }
  el.$sty = el.$styi = parsed
}

export function setValue(
  el: TargetElement,
  value: any,
  forceHydrate: boolean = false,
): void {
  if (recordShadowedRootProp(el, 'value', LocalPropType.VALUE, value)) {
    return
  }

  // store value as _value as well since
  // non-string values will be stringified.
  el._value = value

  if (isHydrating && !isRecreatedNode(el)) {
    ;(__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
      attributeHasMismatch(el, 'value', getClientText(el, value))
    if (!forceHydrate && !shouldForceHydrate(el, 'value')) {
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
 * Used by setDynamicProps only, so need to guard with `toDisplayString`
 */
export function setElementText(
  el: Node & { $txt?: string },
  value: unknown,
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
  }

  if (el.$txt !== value) {
    el.textContent = el.$txt = value as string
  }
}

export function setHtml(el: TargetElement, value: any): void {
  value = value == null ? '' : unsafeToTrustedHTML(value)
  // Align with vdom hydration: server-rendered innerHTML content is trusted
  // as-is in all builds; no write, no compare, no warning. Caching the
  // client value keeps the first post-hydration equal-value update a no-op.
  if (isHydrating && !isRecreatedNode(el)) {
    el.$html = value
    return
  }
  if (el.$html !== value) {
    el.innerHTML = el.$html = value
  }
}

export function setDynamicProps(el: any, args: any[], isSVG?: boolean): void {
  const props = args.length > 1 ? mergeProps(...args) : args[0] || EMPTY_OBJ
  const cacheKey = `$dprops${isApplyingFallthroughProps ? '$' : ''}`
  const prevProps = el[cacheKey] as Record<string, any> | undefined
  const nextProps: Record<string, any> = Object.create(null)

  if (prevProps) {
    for (const key in prevProps) {
      if (!(key in props)) {
        if (
          !isApplyingFallthroughProps ||
          !isRestorableDynamicProp(key) ||
          !restoreLocalRootProp(el, key)
        ) {
          setDynamicProp(el, key, null, isSVG)
        }
      }
    }
  }

  for (const key of Object.keys(props)) {
    const value = props[key]
    const hadKey = prevProps && key in prevProps
    nextProps[key] = value
    if (isApplyingFallthroughProps && !isHydrating && !hadKey) {
      if (key === 'class') {
        seedLocalClass(el)
      } else if (key === 'style') {
        seedLocalStyle(el)
      } else if (isRestorableDynamicProp(key)) {
        captureLocalRootProp(el, key, !!isSVG)
      }
    }
    // Events and objects can have stable identity with mutable internals, so
    // only skip unchanged primitive values.
    if (
      hadKey &&
      !isOn(key) &&
      (value == null || typeof value !== 'object') &&
      Object.is(prevProps[key], value)
    ) {
      continue
    }
    setDynamicProp(el, key, value, isSVG)
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
): void {
  let forceHydrate = false
  if (key === 'class') {
    setClass(el, value, isSVG)
  } else if (key === 'style') {
    setStyle(el, value)
  } else if (isOn(key)) {
    const [event, options] = parseEventName(key)
    if (el.$root) {
      const instance = currentInstance as VaporComponentInstance | null
      if (
        isApplyingFallthroughProps ||
        (instance && forwardsFallthroughAttrs(instance))
      ) {
        onRootBinding(
          el,
          key,
          event,
          value,
          options,
          isApplyingFallthroughProps,
        )
        return
      }
    }
    onBinding(el, event, value, options)
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
    setAttr(el, key, value, isSVG)
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
  proto.$html = proto.$cls = proto.$sty = ''
  proto.$dprops = proto.$dprops$ = proto.$lprops = proto.$evts = undefined
  proto.$clsi = proto.$clsi$ = proto.$styi = proto.$styi$ = undefined
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

function shouldForceHydrate(el: Element, key: string): boolean {
  const { tagName } = el
  return (
    ((tagName === 'INPUT' || tagName === 'OPTION') &&
      (key.endsWith('value') || key === 'indeterminate')) ||
    // force hydrate custom element dynamic props
    tagName.includes('-')
  )
}
