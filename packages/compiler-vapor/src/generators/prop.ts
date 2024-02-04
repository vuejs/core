import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'
import type { SetDynamicPropsIRNode, SetPropIRNode, VaporHelper } from '../ir'
import { genExpression } from './expression'
import type { DirectiveTransformResult } from '../transform'
import { NewlineType, isSimpleIdentifier } from '@vue/compiler-core'

// only the static key prop will reach here
export function genSetProp(
  oper: SetPropIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, vaporHelper } = context
  const {
    prop: { key, value, modifier },
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
    ...call(
      vaporHelper(helperName),
      `n${oper.element}`,
      omitKey ? false : genExpression(key, context),
      genExpression(value, context),
    ),
  ]
}

// dynamic key props and v-bind="{}" will reach here
export function genDynamicProps(
  oper: SetDynamicPropsIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, vaporHelper } = context
  return [
    NEWLINE,
    ...call(
      vaporHelper('setDynamicProps'),
      `n${oper.element}`,
      ...oper.props.map(
        props =>
          Array.isArray(props)
            ? genLiteralObjectProps(props, context) // static and dynamic arg props
            : genExpression(props, context), // v-bind="{}"
      ),
    ),
  ]
}

function genLiteralObjectProps(
  props: DirectiveTransformResult[],
  context: CodegenContext,
): CodeFragment[] {
  const { multi } = context
  return multi(
    ['{ ', ' }', ', '],
    ...props.map(prop => [
      ...genPropertyKey(prop, context),
      `: `,
      ...genExpression(prop.value, context),
    ]),
  )
}

function genPropertyKey(
  { key: node, runtimeCamelize, modifier }: DirectiveTransformResult,
  context: CodegenContext,
): CodeFragment[] {
  const { call, helper } = context

  // static arg was transformed by v-bind transformer
  if (node.isStatic) {
    // only quote keys if necessary
    const keyName = node.content
    return [
      [
        isSimpleIdentifier(keyName) ? keyName : JSON.stringify(keyName),
        NewlineType.None,
        node.loc,
      ],
    ]
  }

  const key = genExpression(node, context)
  if (runtimeCamelize && modifier) {
    return [`[\`${modifier}\${`, ...call(helper('camelize'), key), `}\`]`]
  }

  if (runtimeCamelize) {
    return [`[`, ...call(helper('camelize'), key), `]`]
  }

  if (modifier) {
    return [`[\`${modifier}\${`, ...key, `}\`]`]
  }

  return [`[`, ...key, `]`]
}
