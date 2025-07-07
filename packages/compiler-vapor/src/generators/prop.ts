import {
  NewlineType,
  type SimpleExpressionNode,
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
  canSetValueDirectly,
  capitalize,
  isSVGTag,
  shouldSetAsAttr,
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
  setStyle: { name: 'setStyle' },
  setValue: { name: 'setValue' },
  setAttr: { name: 'setAttr', needKey: true },
  setProp: { name: 'setProp', needKey: true },
  setDOMProp: { name: 'setDOMProp', needKey: true },
  setDynamicProps: { name: 'setDynamicProps' },
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
  const propValue = genPropValue(values, context)
  return [
    NEWLINE,
    ...genCall(
      [helper(resolvedHelper.name), null],
      `n${oper.element}`,
      resolvedHelper.needKey ? genExpression(key, context) : false,
      propValue,
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
  { key: node, modifier, runtimeCamelize, handler, handlerModifiers }: IRProp,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context

  const handlerModifierPostfix = handlerModifiers
    ? handlerModifiers.map(capitalize).join('')
    : ''
  // static arg was transformed by v-bind transformer
  if (node.isStatic) {
    // only quote keys if necessary
    const keyName =
      (handler ? toHandlerKey(node.content) : node.content) +
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
  if (modifier) {
    if (modifier === '.') {
      return getSpecialHelper(key, tagName) || helpers.setDOMProp
    } else {
      return helpers.setAttr
    }
  }

  // 1. special handling for value / style / class / textContent /  innerHTML
  const helper = getSpecialHelper(key, tagName)
  if (helper) {
    return helper
  }

  // 2. Aria DOM properties shared between all Elements in
  //    https://developer.mozilla.org/en-US/docs/Web/API/Element
  if (/aria[A-Z]/.test(key)) {
    return helpers.setDOMProp
  }

  // 3. SVG: always attribute
  if (isSVGTag(tag)) {
    // TODO pass svg flag
    return helpers.setAttr
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
): HelperConfig | undefined {
  // special case for 'value' property
  if (keyName === 'value' && canSetValueDirectly(tagName)) {
    return helpers.setValue
  } else if (keyName === 'class') {
    return helpers.setClass
  } else if (keyName === 'style') {
    return helpers.setStyle
  } else if (keyName === 'innerHTML') {
    return helpers.setHtml
  } else if (keyName === 'textContent') {
    return helpers.setText
  }
}
