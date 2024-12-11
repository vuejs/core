import {
  NewlineType,
  type SimpleExpressionNode,
  isSimpleIdentifier,
} from '@vue/compiler-core'
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
  canSetValueDirectly,
  isHTMLGlobalAttr,
  toHandlerKey,
} from '@vue/shared'

export type HelperConfig = {
  name: VaporHelper
  needKey?: boolean
  acceptRoot?: boolean
}

// this should be kept in sync with runtime-vapor/src/dom/prop.ts
const helpers = {
  setText: { name: 'setText' },
  setHtml: { name: 'setHtml' },
  setClass: { name: 'setClass' },
  setClassIncremental: { name: 'setClassIncremental' },
  setStyle: { name: 'setStyle' },
  setStyleIncremental: { name: 'setStyleIncremental' },
  setValue: { name: 'setValue' },
  setAttr: { name: 'setAttr', needKey: true },
  setDOMProp: { name: 'setDOMProp', needKey: true },
  setDynamicProps: { name: 'setDynamicProps', acceptRoot: true },
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
    root,
  } = oper
  const resolvedHelper = getRuntimeHelper(tag, key.content, modifier, root)
  const propValue = genPropValue(values, context)
  return [
    NEWLINE,
    ...genCall(
      [helper(resolvedHelper.name), null],
      `n${oper.element}`,
      resolvedHelper.needKey ? genExpression(key, context) : false,
      propValue,
      root && resolvedHelper.acceptRoot ? 'true' : undefined,
    ),
  ]
}

// dynamic key props and v-bind="{}" will reach here
export function genDynamicProps(
  oper: SetDynamicPropsIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
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
      oper.root && 'true',
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
  { key: node, modifier, runtimeCamelize, handler }: IRProp,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context

  // static arg was transformed by v-bind transformer
  if (node.isStatic) {
    // only quote keys if necessary
    const keyName = handler ? toHandlerKey(node.content) : node.content
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
    key = genCall(helper('camelize'), key)
  }
  if (handler) {
    key = genCall(helper('toHandlerKey'), key)
  }
  return ['[', modifier && `${JSON.stringify(modifier)} + `, ...key, ']']
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

// TODO
// - 1. textContent + innerHTML Known base dom properties in https://developer.mozilla.org/en-US/docs/Web/API/Element
// - 2. special handling (class / style)
// - 3. SVG: always attribute
// - 4. Custom Elements
//     - always properties unless known global attr or has hyphen (aria- / data-)
// - 5. Normal Elements
//   - 1. Known shared dom properties:
//     - https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement
//   - 2. Each element's known dom properties
//   - 3. Fallback to attribute

function getRuntimeHelper(
  tag: string,
  keyName: string,
  modifier: '.' | '^' | undefined,
  root: boolean,
): HelperConfig {
  const tagName = tag.toUpperCase()
  if (modifier) {
    if (modifier === '.') {
      return getSpecialHelper(keyName, tagName, root) || helpers.setDOMProp
    } else {
      return helpers.setAttr
    }
  } else {
    const helper = getSpecialHelper(keyName, tagName, root)
    if (helper) {
      return helper
    } else if (tagName.includes('-')) {
      // custom element
      if (isHTMLGlobalAttr(keyName) || keyName.includes('-')) {
        return helpers.setAttr
      } else {
        return helpers.setDOMProp
      }
    } else if (/[A-Z]/.test(keyName)) {
      return helpers.setDOMProp
    } else {
      return helpers.setAttr
    }
  }
}

const getSpecialHelper = (
  keyName: string,
  tagName: string,
  root: boolean,
): HelperConfig | undefined => {
  // special case for 'value' property
  if (keyName === 'value' && canSetValueDirectly(tagName)) {
    return helpers.setValue
  }

  if (root) {
    if (keyName === 'class') {
      return helpers.setClassIncremental
    } else if (keyName === 'style') {
      return helpers.setStyleIncremental
    }
  }

  if (keyName === 'class') {
    return helpers.setClass
  } else if (keyName === 'style') {
    return helpers.setStyle
  } else if (keyName === 'innerHTML') {
    return helpers.setHtml
  } else if (keyName === 'textContent') {
    return helpers.setText
  }
}
