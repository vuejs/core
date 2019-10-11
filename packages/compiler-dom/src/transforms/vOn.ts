import {
  transformOn as baseTransform,
  createVOnEventName,
  validateVOnArguments,
  DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
  createCompilerError,
  ElementTypes,
  createCompoundExpression,
  ErrorCodes,
  findProp,
  NodeTypes
} from '@vue/compiler-core'

const genGuard = (condition: string) => `if(${condition})return null;`

const keyCodes: { [key: string]: number | Array<number> } = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  up: 38,
  left: 37,
  right: 39,
  down: 40,
  delete: [8, 46]
}

const modifierCode: { [key: string]: string } = {
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
}

function genKeyFilter (keys: Array<string>): string {
  return (
    // make sure the key filters only apply to KeyboardEvents
    // #9441: can't use 'keyCode' in $event because Chrome autofill fires fake
    // key events that do not have keyCode property...
    `if(!$event.type.indexOf('key')&&` +
    `${keys.map(genFilterCode).join('&&')})return null;`
  )
}

export const transformOn: DirectiveTransform = (dir, node, context) => {
  let hasDomModifiers = dir.modifiers.length && dir.modifiers.some(m => modifierCode[m] || keyCodes[m])
  if (!hasDomModifiers) return baseTransform(dir, node, context)

  validateVOnArguments(dir, node, context)

  const { modifiers, loc } = dir
  let { exp } = dir
  if (!dir.exp && !modifiers.length) {
    context.onError(createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc))
  }
  let eventName = createVOnEventName(dir.arg!)
  
  if (exp) {
    let guards = dir.modifiers.map(m => modifierCode[m] || (keyCodes[m] ? ))
    if (dir.modifiers.indexOf('stop') > -1) {
      exp = createCompoundExpression([
        `function ($event) {`,
        '$event.stopPropagation(),',
        ...(exp.type === NodeTypes.SIMPLE_EXPRESSION ? [exp] : exp.children),
        `}`
      ])
    }
  }
  return {
    props: [
      createObjectProperty(
        eventName,
        exp || createSimpleExpression(`() => {}`, false, loc)
      )
    ],
    needRuntime: false
  }
}