import {
  transformOn as baseTransform,
  createVOnEventName,
  validateVOnArguments,
  processVOnHanlder,
  VOnDirectiveNode,
  DirectiveTransform,
  createObjectProperty,
  ExpressionNode,
  createCompoundExpression,
  NodeTypes
} from '@vue/compiler-core'
import { EMPTY_ARR, fnExpRE } from '@vue/shared'

// const keyCodes: { [key: string]: number | Array<number> } = {
//   esc: 27,
//   tab: 9,
//   enter: 13,
//   space: 32,
//   up: 38,
//   left: 37,
//   right: 39,
//   down: 40,
//   delete: [8, 46]
// }

const genGuard = (condition: string) => `if(${condition})return null;`
const modifierCode = {
  stop: '$event.stopPropagation();',
  prevent: '$event.preventDefault();',
  self: genGuard(`$event.target !== $event.currentTarget`),
  ctrl: genGuard(`!$event.ctrlKey`),
  shift: genGuard(`!$event.shiftKey`),
  alt: genGuard(`!$event.altKey`),
  meta: genGuard(`!$event.metaKey`),
  left: genGuard(`'button' in $event && $event.button !== 0`),
  middle: genGuard(`'button' in $event && $event.button !== 1`),
  right: genGuard(`'button' in $event && $event.button !== 2`)
} as const

const isValidDomModifier = (key: string): key is keyof typeof modifierCode =>
  key in modifierCode

export const transformOn: DirectiveTransform = (
  dir: VOnDirectiveNode,
  node,
  context
) => {
  validateVOnArguments(dir, context)

  const { modifiers, arg } = dir
  let hasDomModifiers = modifiers.length && modifiers.some(isValidDomModifier)
  if (!hasDomModifiers) return baseTransform(dir, node, context)

  let eventName = createVOnEventName(arg)
  let guards = modifiers.map(
    m => (isValidDomModifier(m) ? modifierCode[m] : '')
  )
  let exp: ExpressionNode | undefined = dir.exp
  if (exp) {
    if (fnExpRE.test(exp.content)) exp.content = `(${exp.content})($event)`
    exp = processVOnHanlder(exp, context)
  }
  exp = createCompoundExpression([
    `$event => {`,
    ...guards,
    ...(exp
      ? exp.type === NodeTypes.SIMPLE_EXPRESSION
        ? ['(', exp, ')', '($event)']
        : exp.children
      : EMPTY_ARR),
    `}`
  ])
  let res = {
    props: [createObjectProperty(eventName, exp)],
    needRuntime: false
  }
  console.log(`result`, JSON.stringify(res.props[0].value, null, 2))
  return res
}
