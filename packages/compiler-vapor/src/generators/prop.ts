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
  type SetInheritAttrsIRNode,
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
  attributeCache,
  isHTMLGlobalAttr,
  isHTMLTag,
  isMathMLGlobalAttr,
  isMathMLTag,
  isSVGTag,
  isSvgGlobalAttr,
  shouldSetAsAttr,
  toHandlerKey,
} from '@vue/shared'

// only the static key prop will reach here
export function genSetProp(
  oper: SetPropIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  const {
    prop: { key, values, modifier },
    tag,
  } = oper

  const keyName = key.content
  const tagName = tag.toUpperCase()
  const attrCacheKey = `${tagName}_${keyName}`

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
  } else if (
    attributeCache[attrCacheKey] === undefined
      ? (attributeCache[attrCacheKey] = shouldSetAsAttr(
          tag.toUpperCase(),
          keyName,
        ))
      : attributeCache[attrCacheKey]
  ) {
    helperName = 'setAttr'
  } else if (
    (isHTMLTag(tag) && isHTMLGlobalAttr(keyName)) ||
    (isSVGTag(tag) && isSvgGlobalAttr(keyName)) ||
    (isMathMLTag(tag) && isMathMLGlobalAttr(keyName))
  ) {
    helperName = 'setDOMProp'
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
      oper.root && 'true',
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
      genMulti(
        DELIMITERS_ARRAY,
        ...oper.props.map(
          props =>
            Array.isArray(props)
              ? genLiteralObjectProps(props, context) // static and dynamic arg props
              : props.kind === IRDynamicPropsKind.ATTRIBUTE
                ? genLiteralObjectProps([props], context) // dynamic arg props
                : genExpression(props.value, context), // v-bind=""
        ),
      ),
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

export function genSetInheritAttrs(
  { staticProps, dynamicProps }: SetInheritAttrsIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context

  // - `undefined` : no props
  // - `false`     : all props are static
  // - `string[]`  : list of props are dynamic
  // - `true`      : all props as dynamic
  const value =
    dynamicProps === true
      ? 'true'
      : dynamicProps.length
        ? genMulti(
            DELIMITERS_ARRAY,
            ...dynamicProps.map(p => JSON.stringify(p)),
          )
        : staticProps
          ? 'false'
          : null
  if (value == null) return []
  return [NEWLINE, ...genCall(vaporHelper('setInheritAttrs'), value)]
}
