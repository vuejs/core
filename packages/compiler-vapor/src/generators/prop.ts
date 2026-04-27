import {
  NewlineType,
  type SimpleExpressionNode,
  createSimpleExpression,
  isSimpleIdentifier,
} from '@vue/compiler-dom'
import type {
  Expression,
  Identifier,
  ObjectProperty,
  StringLiteral,
} from '@babel/types'
import { type ParserOptions, parseExpression } from '@babel/parser'
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
  shouldSetAsAttr,
  toHandlerKey,
} from '@vue/shared'

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
  toggleClass: { name: 'toggleClass' },
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
  const toggleClassValues =
    resolvedHelper.name === 'setClass' && !resolvedHelper.isSVG
      ? genToggleClassValues(values, context)
      : undefined
  if (toggleClassValues) {
    const calls = toggleClassValues.map(toggleClassValue =>
      genCall(
        [helper(helpers.toggleClass.name), null],
        `n${oper.element}`,
        JSON.stringify(toggleClassValue.className),
        toggleClassValue.value,
      ),
    )
    return [
      NEWLINE,
      toggleClassValues.length > 1 && '(',
      ...calls.flatMap((call, i) => (i > 0 ? [', ', ...call] : call)),
      toggleClassValues.length > 1 && ')',
    ]
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

function genToggleClassValues(
  values: SimpleExpressionNode[],
  context: CodegenContext,
): { className: string; value: CodeFragment[] }[] | undefined {
  if (values.length !== 1) {
    return
  }
  const simpleObjectClasses = getSimpleObjectClasses(values[0])
  if (!simpleObjectClasses) {
    return
  }
  return simpleObjectClasses.flatMap(({ classNames, value }) => {
    const exp = createSimpleExpression(
      values[0].content.slice(value.start! - 1, value.end! - 1),
      false,
      values[0].loc,
    )
    exp.ast = parseExpression(`(${exp.content})`, getParserOptions(context))
    const valueCode = genExpression(exp, context)
    return classNames.map(className => ({ className, value: valueCode }))
  })
}

function getParserOptions(context: CodegenContext): ParserOptions {
  return {
    plugins: context.options.expressionPlugins
      ? [...context.options.expressionPlugins, 'typescript']
      : ['typescript'],
  }
}

function getSimpleObjectClasses(
  value: SimpleExpressionNode | undefined,
): { classNames: string[]; value: Expression }[] | undefined {
  const ast = value && value.ast
  if (ast == null || ast === false || ast.type !== 'ObjectExpression') {
    return
  }
  if (!ast.properties.length) {
    return
  }
  const classes: { classNames: string[]; value: Expression }[] = []
  for (const prop of ast.properties) {
    if (prop.type !== 'ObjectProperty' || prop.computed || prop.shorthand) {
      return
    }
    const classNames = getStaticClassNames(prop)
    if (
      !classNames ||
      prop.value.start == null ||
      prop.value.end == null ||
      !isExpression(prop.value)
    ) {
      return
    }
    classes.push({ classNames, value: prop.value })
  }
  return classes
}

function getStaticClassNames(prop: ObjectProperty): string[] | undefined {
  const key = prop.key as Identifier | StringLiteral
  const value =
    key.type === 'Identifier'
      ? key.name
      : key.type === 'StringLiteral'
        ? key.value
        : undefined
  const classNames = value && value.trim().split(/\s+/)
  if (classNames && classNames[0]) {
    return classNames
  }
}

function isExpression(value: ObjectProperty['value']): value is Expression {
  return !value.type.endsWith('Pattern')
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
