import {
  NewlineType,
  type SimpleExpressionNode,
  createSimpleExpression,
  isSimpleIdentifier,
} from '@vue/compiler-dom'
import type { CodegenContext } from '../generate'
import {
  IRDynamicPropsKind,
  type IRProp,
  type SetDynamicPropsIRNode,
  type SetPropIRNode,
  type VaporHelper,
} from '../ir'
import { genExpression } from './expression'
import {
  type CodeFragment,
  DELIMITERS_ARRAY,
  DELIMITERS_OBJECT,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'
import {
  camelize,
  canSetValueDirectly,
  capitalize,
  extend,
  isSVGTag,
  normalizeClass,
  shouldSetAsAttr,
  toHandlerKey,
} from '@vue/shared'
import { getLiteralExpressionValue } from '../utils'
import { type ParserOptions, parseExpression } from '@babel/parser'
import type {
  ConditionalExpression,
  Expression,
  ObjectExpression,
  ObjectProperty,
} from '@babel/types'

export type HelperConfig = {
  name: VaporHelper
  needKey?: boolean
  isSVG?: boolean
  acceptRoot?: boolean
}

// this should be kept in sync with runtime-vapor/src/dom/prop.ts
const helpers = {
  setText: { name: 'setText' },
  setHtml: { name: 'setHtml' },
  setClass: { name: 'setClass' },
  setClassName: { name: 'setClassName' },
  setStyle: { name: 'setStyle' },
  setValue: { name: 'setValue' },
  setAttr: { name: 'setAttr', needKey: true },
  setProp: { name: 'setProp', needKey: true },
  setDOMProp: { name: 'setDOMProp', needKey: true },
} as const satisfies Partial<Record<VaporHelper, HelperConfig>>

// only the static key prop will reach here
export function genSetProp(
  oper: SetPropIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const {
    prop: { key, values, modifier },
    tag,
  } = oper
  const resolvedHelper = getRuntimeHelper(tag, key.content, modifier)
  if (
    key.content === 'class' &&
    !resolvedHelper.isSVG &&
    resolvedHelper.name === 'setClass'
  ) {
    const className = genSetClassName(oper, context)
    if (className) return className
  }
  const propValue = genPropValue(values, context)
  return [
    NEWLINE,
    ...genCall(
      [helper(resolvedHelper.name), null],
      `n${oper.element}`,
      resolvedHelper.needKey ? genExpression(key, context) : false,
      propValue,
      resolvedHelper.isSVG && 'true',
    ),
  ]
}

interface ClassNameEntry {
  className: string
  condition?: SimpleExpressionNode
  negate?: boolean
  value?: boolean
}

interface ClassNameInfo {
  prefix: string
  suffix: string
  entries: ClassNameEntry[]
}

const MAX_CLASS_NAME_ENTRIES = 31

function genSetClassName(
  oper: SetPropIRNode,
  context: CodegenContext,
): CodeFragment[] | undefined {
  const info = resolveClassName(oper.prop.values, context)
  if (!info) return

  const { helper } = context
  const flags = genClassFlags(info.entries, context)
  const fragments = genMulti(
    DELIMITERS_ARRAY,
    ...info.entries.map(entry =>
      JSON.stringify(
        !info.prefix && info.entries.length === 1
          ? entry.className
          : ` ${entry.className}`,
      ),
    ),
  )

  return [
    NEWLINE,
    ...genCall(
      [helper('setClassName'), '""'],
      `n${oper.element}`,
      flags,
      fragments,
      info.prefix && JSON.stringify(info.prefix),
      info.suffix && JSON.stringify(info.suffix),
    ),
  ]
}

function resolveClassName(
  values: SimpleExpressionNode[],
  context: CodegenContext,
): ClassNameInfo | undefined {
  let prefix = ''
  let suffix = ''
  const entries: ClassNameEntry[] = []
  let sawDynamic = false
  let sawSuffix = false

  for (const value of values) {
    const staticValue = getLiteralExpressionValue(value, true)
    if (staticValue != null) {
      const normalized = normalizeClass(staticValue)
      if (normalized) {
        if (sawSuffix) {
          suffix = appendClass(suffix, normalized)
        } else if (sawDynamic) {
          sawSuffix = true
          suffix = appendClass(suffix, normalized)
        } else {
          prefix = appendClass(prefix, normalized)
        }
      }
      continue
    }

    const ast = value.ast
    if (!ast || sawSuffix) return
    sawDynamic = true

    if (ast.type === 'ObjectExpression') {
      if (!resolveObjectClassName(value, ast, entries, context)) return
    } else if (ast.type === 'ConditionalExpression') {
      if (!resolveConditionalClassName(value, ast, entries, context)) return
    } else {
      return
    }
  }

  return entries.length && entries.length <= MAX_CLASS_NAME_ENTRIES
    ? { prefix, suffix, entries }
    : undefined
}

function resolveObjectClassName(
  source: SimpleExpressionNode,
  ast: ObjectExpression,
  entries: ClassNameEntry[],
  context: CodegenContext,
): boolean {
  for (const prop of ast.properties) {
    if (prop.type !== 'ObjectProperty' || prop.computed) {
      return false
    }

    const rawClassName = getObjectPropertyName(prop)
    if (rawClassName == null) return false

    const className = normalizeClass(rawClassName)
    if (!className) continue

    const value = getBooleanValue(prop.value)
    entries.push({
      className,
      value,
      condition:
        value == null
          ? createSubExpression(source, prop.value as Expression, context)
          : undefined,
    })
  }
  return true
}

function resolveConditionalClassName(
  source: SimpleExpressionNode,
  ast: ConditionalExpression,
  entries: ClassNameEntry[],
  context: CodegenContext,
): boolean {
  const consequent = getStringClassValue(ast.consequent)
  const alternate = getStringClassValue(ast.alternate)

  if (consequent && alternate === '') {
    entries.push({
      className: consequent,
      condition: createSubExpression(source, ast.test, context),
    })
    return true
  } else if (alternate && consequent === '') {
    entries.push({
      className: alternate,
      condition: createSubExpression(source, ast.test, context),
      negate: true,
    })
    return true
  }

  return false
}

function genClassFlags(
  entries: ClassNameEntry[],
  context: CodegenContext,
): CodeFragment[] {
  const values: CodeFragment[] = []

  entries.forEach((entry, index) => {
    if (index) values.push(' | ')

    const bit = 1 << index
    if (entry.value != null) {
      values.push(entry.value ? String(bit) : '0')
      return
    }

    values.push(
      '(',
      ...genExpression(entry.condition!, context),
      entry.negate ? ` ? 0 : ${bit}` : ` ? ${bit} : 0`,
      ')',
    )
  })

  return values
}

function appendClass(base: string, value: string): string {
  return base ? (value ? `${base} ${value}` : base) : value
}

function getObjectPropertyName(prop: ObjectProperty): string | undefined {
  const key = prop.key
  if (key.type === 'Identifier') {
    return key.name
  } else if (key.type === 'StringLiteral') {
    return key.value
  } else if (key.type === 'NumericLiteral') {
    return String(key.value)
  }
}

function getStringClassValue(node: Expression): string | undefined {
  if (node.type === 'StringLiteral') {
    return normalizeClass(node.value)
  } else if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return normalizeClass(node.quasis[0].value.cooked || '')
  } else if (
    node.type === 'NullLiteral' ||
    (node.type === 'BooleanLiteral' && !node.value)
  ) {
    return ''
  }
}

function getBooleanValue(node: ObjectProperty['value']): boolean | undefined {
  if (node.type === 'BooleanLiteral') {
    return node.value
  }
}

function createSubExpression(
  source: SimpleExpressionNode,
  node: Expression,
  context: CodegenContext,
): SimpleExpressionNode {
  const start = node.start == null ? 0 : node.start - 1
  const end = node.end == null ? source.content.length : node.end - 1
  const content = source.content.slice(start, end)
  const expression = createSimpleExpression(content, false, source.loc)
  expression.ast = isSimpleIdentifier(content)
    ? null
    : parseExpression(`(${content})`, getParserOptions(context))
  return expression
}

function getParserOptions(context: CodegenContext): ParserOptions {
  const plugins = context.options.expressionPlugins
  return {
    plugins: plugins ? [...plugins, 'typescript'] : ['typescript'],
  }
}

// dynamic key props and v-bind="{}" will reach here
export function genDynamicProps(
  oper: SetDynamicPropsIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const isSVG = isSVGTag(oper.tag)
  const values = oper.props.map(props =>
    Array.isArray(props)
      ? genLiteralObjectProps(props, context) // static and dynamic arg props
      : props.kind === IRDynamicPropsKind.ATTRIBUTE
        ? genLiteralObjectProps([props], context) // dynamic arg props
        : genExpression(props.value, context),
  ) // v-bind=""
  return [
    NEWLINE,
    ...genCall(
      helper('setDynamicProps'),
      `n${oper.element}`,
      genMulti(DELIMITERS_ARRAY, ...values),
      isSVG && 'true',
    ),
  ]
}

function genLiteralObjectProps(
  props: IRProp[],
  context: CodegenContext,
): CodeFragment[] {
  return genMulti(
    DELIMITERS_OBJECT,
    ...props.map(prop => [
      ...genPropKey(prop, context),
      `: `,
      ...genPropValue(prop.values, context),
    ]),
  )
}

export function genPropKey(
  { key: node, modifier, runtimeCamelize, handler, handlerModifiers }: IRProp,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context

  const handlerModifierPostfix =
    handlerModifiers && handlerModifiers.options
      ? handlerModifiers.options.map(capitalize).join('')
      : ''
  // static arg was transformed by v-bind transformer
  if (node.isStatic) {
    // only quote keys if necessary
    const keyName =
      (handler ? toHandlerKey(camelize(node.content)) : node.content) +
      handlerModifierPostfix
    return [
      [
        isSimpleIdentifier(keyName) ? keyName : JSON.stringify(keyName),
        NewlineType.None,
        node.loc,
      ],
    ]
  }

  let key = genExpression(node, context)
  if (runtimeCamelize) {
    key.push(' || ""')
    key = genCall(helper('camelize'), key)
  }
  if (handler) {
    key = genCall(helper('toHandlerKey'), key)
  }
  return [
    '[',
    modifier && `${JSON.stringify(modifier)} + `,
    ...key,
    handlerModifierPostfix
      ? ` + ${JSON.stringify(handlerModifierPostfix)}`
      : undefined,
    ']',
  ]
}

export function genPropValue(
  values: SimpleExpressionNode[],
  context: CodegenContext,
): CodeFragment[] {
  if (values.length === 1) {
    return genExpression(values[0], context)
  }
  return genMulti(
    DELIMITERS_ARRAY,
    ...values.map(expr => genExpression(expr, context)),
  )
}

function getRuntimeHelper(
  tag: string,
  key: string,
  modifier: '.' | '^' | undefined,
): HelperConfig {
  const tagName = tag.toUpperCase()
  const isSVG = isSVGTag(tag)

  if (modifier) {
    if (modifier === '.') {
      return getSpecialHelper(key, tagName, isSVG) || helpers.setDOMProp
    } else {
      return isSVG ? extend({ isSVG: true }, helpers.setAttr) : helpers.setAttr
    }
  }

  // 1. special handling for value / style / class / textContent /  innerHTML
  const helper = getSpecialHelper(key, tagName, isSVG)
  if (helper) {
    return helper
  }

  // 2. Aria DOM properties shared between all Elements in
  //    https://developer.mozilla.org/en-US/docs/Web/API/Element
  if (/aria[A-Z]/.test(key)) {
    return helpers.setDOMProp
  }

  // 3. SVG: always attribute
  if (isSVG) {
    return extend({ isSVG: true }, helpers.setAttr)
  }

  // 4. respect shouldSetAsAttr used in vdom and setDynamicProp for consistency
  //    also fast path for presence of hyphen (covers data-* and aria-*)
  if (shouldSetAsAttr(tagName, key) || key.includes('-')) {
    return helpers.setAttr
  }

  // 5. Fallback to setDOMProp, which has a runtime `key in el` check to
  // ensure behavior consistency with vdom
  return helpers.setProp
}

function getSpecialHelper(
  keyName: string,
  tagName: string,
  isSVG: boolean,
): HelperConfig | undefined {
  // special case for 'value' property
  if (keyName === 'value' && canSetValueDirectly(tagName)) {
    return helpers.setValue
  } else if (keyName === 'class') {
    // for svg, class should be set as attribute
    return extend({ isSVG }, helpers.setClass)
  } else if (keyName === 'style') {
    return helpers.setStyle
  } else if (keyName === 'innerHTML') {
    return helpers.setHtml
  } else if (keyName === 'textContent') {
    return helpers.setText
  }
}
