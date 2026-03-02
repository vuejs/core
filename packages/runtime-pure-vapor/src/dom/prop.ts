/**
### 核心功能
1. 属性设置
   
   - setProp : 通用属性设置函数，自动判断是设置 DOM 属性还是 HTML 特性
   - setAttr : 设置 HTML 特性（attribute）
   - setDOMProp : 设置 DOM 属性（property）
2. 特殊属性处理
   
   - setClass : 处理 class 属性，支持增量更新
   - setStyle : 处理 style 属性，支持增量更新
   - setValue : 处理表单元素的 value 属性
   - setText : 设置文本节点内容
   - setElementText : 设置元素的文本内容
   - setHtml : 设置元素的 HTML 内容
3. 动态属性处理
   
   - setDynamicProps : 批量设置动态属性
   - setDynamicProp : 设置单个动态属性，根据 key 类型调用相应的处理函数
4. Block 级别操作
   
   - setBlockText : 为 Block 设置文本
   - setBlockHtml : 为 Block 设置 HTML
5. 性能优化
   
   - optimizePropertyLookup : 优化 Element 和 Text 节点上的属性查找，通过在原型上预定义缓存属性
### 设计特点
- 缓存机制 : 使用 $ 前缀的属性（如 $cls 、 $sty 、 $txt ）缓存之前的值，避免不必要的 DOM 操作
- 增量更新 : class 和 style 支持增量更新，只更新变化的部分
- 智能判断 : 根据元素类型和属性名称自动决定使用属性还是特性
- 错误处理 : 对某些会抛出错误的属性进行 try-catch 保护
- 特殊处理 : 支持自定义元素、v-model 的 true-value/false-value 等特殊情况
 */

import {
  type NormalizedStyle,
  camelize,
  canSetValueDirectly,
  includeBooleanAttr,
  isArray,
  isOn,
  isString,
  normalizeClass,
  normalizeStyle,
  parseStringStyle,
  toDisplayString,
} from '@vue/shared'
import { on } from './event'
import {
  type GenericComponentInstance,
  MismatchTypes,
  currentInstance,
  getAttributeMismatch,
  isMapEqual,
  isMismatchAllowed,
  isSetEqual,
  isValidHtmlOrSvgAttribute,
  mergeProps,
  patchStyle,
  queuePostFlushCb,
  shouldSetAsProp,
  toClassSet,
  toStyleMap,
  unsafeToTrustedHTML,
  vShowHidden,
  warn,
  warnPropMismatch,
  xlinkNS,
} from '@vue/runtime-dom'
import {
  type VaporComponentInstance,
  isApplyingFallthroughProps,
  isVaporComponent,
} from '../component'
import type { Block } from '../block'
import type { VaporElement } from '../apiDefineCustomElement'

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

export function setAttr(
  el: any,
  key: string,
  value: any,
  isSVG: boolean = false,
): void {
  if (!isApplyingFallthroughProps && el.$root && hasFallthroughKey(key)) {
    return
  }

  // 特殊情况：<input v-model type="checkbox"> 配合
  // :true-value & :false-value
  // 将值存储为 DOM 属性，因为非字符串值会被
  // 转换为字符串。
  if (key === 'true-value') {
    ;(el as any)._trueValue = value
  } else if (key === 'false-value') {
    ;(el as any)._falseValue = value
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
      if (value != null) {
        el.setAttribute(key, value)
      } else {
        el.removeAttribute(key)
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
  if (!isApplyingFallthroughProps && el.$root && hasFallthroughKey(key)) {
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

  // 某些属性会执行值验证并抛出错误，
  // 某些属性只有 getter 没有 setter，在 'use strict' 模式下会报错
  // 例如：<select :type="null"></select> <select :willValidate="null"></select>
  try {
    el[key] = value
  } catch (e: any) {
    // 如果值是从 null/undefined 自动转换的，则不警告
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
): void {
  if (el.$root) {
    setClassIncremental(el, value)
  } else {
    value = normalizeClass(value)

    if (value !== el.$cls) {
      if (isSVG) {
        el.setAttribute('class', (el.$cls = value))
      } else {
        el.className = el.$cls = value
      }
    }
  }
}

function setClassIncremental(el: any, value: any): void {
  const cacheKey = `$clsi${isApplyingFallthroughProps ? '$' : ''}`
  const normalizedValue = normalizeClass(value)

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

    patchStyle(el, el.$sty, (el.$sty = normalizedValue))
  }
}

function setStyleIncremental(el: any, value: any): void {
  const cacheKey = `$styi${isApplyingFallthroughProps ? '$' : ''}`
  const normalizedValue = isString(value)
    ? parseStringStyle(value)
    : (normalizeStyle(value) as NormalizedStyle | undefined)

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

  // 将值也存储为 _value，因为
  // 非字符串值会被转换为字符串。
  el._value = value

  // #4956: <option> 的 value 会回退到其文本内容，所以我们需要
  // 比较其属性值而不是 value 属性。
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
 * 仅在文本节点上调用！
 * 编译器还应确保传递给此处的值已经通过
 * `toDisplayString` 转换
 */
export function setText(el: Text & { $txt?: string }, value: string): void {
  if (el.$txt !== value) {
    el.nodeValue = el.$txt = value
  }
}

/**
 * 仅由 setDynamicProps 使用，因此需要用 `toDisplayString` 保护
 */
export function setElementText(
  el: Node & { $txt?: string },
  value: unknown,
): void {
  value = toDisplayString(value)

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
 * 仅在开发环境使用
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

export function setDynamicProps(el: any, args: any[], isSVG?: boolean): void {
  const props = args.length > 1 ? mergeProps(...args) : args[0]
  const cacheKey = `$dprops${isApplyingFallthroughProps ? '$' : ''}`
  const prevKeys = el[cacheKey] as string[]

  if (prevKeys) {
    for (const key of prevKeys) {
      if (!(key in props)) {
        setDynamicProp(el, key, null, isSVG)
      }
    }
  }

  for (const key of (el[cacheKey] = Object.keys(props))) {
    setDynamicProp(el, key, props[key], isSVG)
  }
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
    on(el, key[2].toLowerCase() + key.slice(3), value, { effect: true })
  } else if (
    // 使用 .prop 修饰符强制水合 v-bind
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
    // 自定义元素
    (el as VaporElement)._isVueCE &&
    (/[A-Z]/.test(key) || !isString(value))
  ) {
    setDOMProp(el, camelize(key), value, forceHydrate, key)
  } else {
    setAttr(el, key, value, isSVG)
  }
  return value
}

let isOptimized = false

/**
 * 优化 Element 和 Text 节点上缓存属性的属性查找
 */
export function optimizePropertyLookup(): void {
  if (isOptimized) return
  isOptimized = true
  const proto = Element.prototype as any
  proto.$transition = undefined
  proto.$key = undefined
  proto.$fc = proto.$evtclick = undefined
  proto.$root = false
  proto.$html = proto.$cls = proto.$sty = ''
  // 将 $txt 初始化为 undefined 而不是空字符串，以确保 setText()
  // 即使值为空字符串也能正确更新文本节点。
  // 这可以防止出现 setText(node, '') 被跳过的情况，
  // 因为 $txt === '' 会返回 true，导致原始 nodeValue 保持不变。
  ;(Text.prototype as any).$txt = undefined
}
