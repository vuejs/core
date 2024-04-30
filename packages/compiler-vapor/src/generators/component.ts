import { camelize, extend, isArray } from '@vue/shared'
import type { CodegenContext } from '../generate'
import {
  type CreateComponentIRNode,
  IRDynamicPropsKind,
  type IRProp,
  type IRProps,
  type IRPropsStatic,
} from '../ir'
import {
  type CodeFragment,
  NEWLINE,
  SEGMENTS_ARRAY_NEWLINE,
  SEGMENTS_OBJECT,
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
  const { vaporHelper } = context

  const tag = genTag()
  const isRoot = oper.root
  const rawProps = genRawProps(oper.props, context)

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
}

export function genRawProps(props: IRProps[], context: CodegenContext) {
  const frag = props
    .map(props => {
      if (isArray(props)) {
        if (!props.length) return
        return genStaticProps(props, context)
      } else {
        let expr: CodeFragment[]
        if (props.kind === IRDynamicPropsKind.ATTRIBUTE)
          expr = genMulti(SEGMENTS_OBJECT, genProp(props, context))
        else {
          expr = genExpression(props.value, context)
          if (props.handler) expr = genCall(context.helper('toHandlers'), expr)
        }
        return ['() => (', ...expr, ')']
      }
    })
    .filter(
      Boolean as any as (v: CodeFragment[] | undefined) => v is CodeFragment[],
    )
  if (frag.length) {
    return genMulti(SEGMENTS_ARRAY_NEWLINE, ...frag)
  }
}

function genStaticProps(
  props: IRPropsStatic,
  context: CodegenContext,
): CodeFragment[] {
  return genMulti(
    props.length > 1 ? SEGMENTS_OBJECT_NEWLINE : SEGMENTS_OBJECT,
    ...props.map(prop => genProp(prop, context, true)),
  )
}

function genProp(prop: IRProp, context: CodegenContext, isStatic?: boolean) {
  return [
    ...genPropKey(prop, context),
    ': ',
    ...(prop.handler
      ? genEventHandler(context, prop.values[0])
      : isStatic
        ? ['() => (', ...genExpression(prop.values[0], context), ')']
        : genExpression(prop.values[0], context)),
    ...(prop.model
      ? [...genModelEvent(prop, context), ...genModelModifiers(prop, context)]
      : []),
  ]
}

function genModelEvent(prop: IRProp, context: CodegenContext): CodeFragment[] {
  const name = prop.key.isStatic
    ? [JSON.stringify(`onUpdate:${camelize(prop.key.content)}`)]
    : ['["onUpdate:" + ', ...genExpression(prop.key, context), ']']
  const handler = genModelHandler(prop.values[0], context)

  return [',', NEWLINE, ...name, ': ', ...handler]
}

function genModelModifiers(
  prop: IRProp,
  context: CodegenContext,
): CodeFragment[] {
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
