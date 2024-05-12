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
import { toHandlerKey } from '@vue/shared'

// only the static key prop will reach here
export function genSetProp(
  oper: SetPropIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  const {
    prop: { key, values, modifier },
  } = oper

  const keyName = key.content

  let helperName: VaporHelper
  let omitKey = false
  if (keyName === 'class') {
    helperName = 'setClass'
    omitKey = true
  } else if (keyName === 'style') {
    helperName = 'setStyle'
    omitKey = true
  } else if (modifier) {
    helperName = modifier === '.' ? 'setDOMProp' : 'setAttr'
  } else {
    helperName = 'setDynamicProp'
  }

  return [
    NEWLINE,
    ...genCall(
      [vaporHelper(helperName), null],
      `n${oper.element}`,
      omitKey ? false : genExpression(key, context),
      genPropValue(values, context),
    ),
  ]
}

// dynamic key props and v-bind="{}" will reach here
export function genDynamicProps(
  oper: SetDynamicPropsIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  return [
    NEWLINE,
    ...genCall(
      vaporHelper('setDynamicProps'),
      `n${oper.element}`,
      ...oper.props.map(
        props =>
          Array.isArray(props)
            ? genLiteralObjectProps(props, context) // static and dynamic arg props
            : props.kind === IRDynamicPropsKind.ATTRIBUTE
              ? genLiteralObjectProps([props], context) // dynamic arg props
              : genExpression(props.value, context), // v-bind=""
      ),
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

function genPropValue(values: SimpleExpressionNode[], context: CodegenContext) {
  if (values.length === 1) {
    return genExpression(values[0], context)
  }
  return genMulti(
    DELIMITERS_ARRAY,
    ...values.map(expr => genExpression(expr, context)),
  )
}
