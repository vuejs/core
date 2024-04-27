import { camelize, extend, isArray } from '@vue/shared'
import type { CodegenContext } from '../generate'
import type { CreateComponentIRNode, IRProp } from '../ir'
import {
  type CodeFragment,
  NEWLINE,
  SEGMENTS_ARRAY,
  SEGMENTS_OBJECT_NEWLINE,
  genCall,
  genMulti,
} from './utils'
import { genExpression } from './expression'
import { genPropKey } from './prop'
import { createSimpleExpression } from '@vue/compiler-dom'
import { genEventHandler } from './event'
import { genDirectiveModifiers, genDirectivesForElement } from './directive'
import { genModelHandler } from './modelValue'

// TODO: generate component slots
export function genCreateComponent(
  oper: CreateComponentIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper, vaporHelper } = context

  const tag = genTag()
  const isRoot = oper.root
  const rawProps = genRawProps()

  return [
    NEWLINE,
    `const n${oper.id} = `,
    ...genCall(
      vaporHelper('createComponent'),
      tag,
      rawProps || (isRoot ? 'null' : false),
      isRoot && 'true',
    ),
    ...genDirectivesForElement(oper.id, context),
  ]

  function genTag() {
    if (oper.resolve) {
      return [`_component_${oper.tag}`]
    } else {
      return genExpression(
        extend(createSimpleExpression(oper.tag, false), { ast: null }),
        context,
      )
    }
  }

  function genRawProps() {
    const props = oper.props
      .map(props => {
        if (isArray(props)) {
          if (!props.length) return
          return genStaticProps(props)
        } else {
          let expr = genExpression(props.value, context)
          if (props.handler) expr = genCall(helper('toHandlers'), expr)
          return ['() => (', ...expr, ')']
        }
      })
      .filter(Boolean)
    if (props.length) {
      return genMulti(SEGMENTS_ARRAY, ...props)
    }
  }

  function genStaticProps(props: IRProp[]) {
    return genMulti(
      SEGMENTS_OBJECT_NEWLINE,
      ...props.map(prop => {
        return [
          ...genPropKey(prop, context),
          ': ',
          ...(prop.handler
            ? genEventHandler(context, prop.values[0])
            : ['() => (', ...genExpression(prop.values[0], context), ')']),
          ...(prop.model
            ? [...genModelEvent(prop), ...genModelModifiers(prop)]
            : []),
        ]
      }),
    )

    function genModelEvent(prop: IRProp): CodeFragment[] {
      const name = prop.key.isStatic
        ? [JSON.stringify(`onUpdate:${camelize(prop.key.content)}`)]
        : ['["onUpdate:" + ', ...genExpression(prop.key, context), ']']
      const handler = genModelHandler(prop.values[0], context)

      return [',', NEWLINE, ...name, ': ', ...handler]
    }

    function genModelModifiers(prop: IRProp): CodeFragment[] {
      const { key, modelModifiers } = prop
      if (!modelModifiers || !modelModifiers.length) return []

      const modifiersKey = key.isStatic
        ? key.content === 'modelValue'
          ? [`modelModifiers`]
          : [`${key.content}Modifiers`]
        : ['[', ...genExpression(key, context), ' + "Modifiers"]']

      const modifiersVal = genDirectiveModifiers(modelModifiers)
      return [',', NEWLINE, ...modifiersKey, `: () => ({ ${modifiersVal} })`]
    }
  }
}
