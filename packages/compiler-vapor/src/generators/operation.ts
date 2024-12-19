import { type IREffect, IRNodeTypes, type OperationNode } from '../ir'
import type { CodegenContext } from '../generate'
import { genInsertNode, genPrependNode } from './dom'
import { genSetDynamicEvents, genSetEvent } from './event'
import { genFor } from './for'
import { genSetHtml } from './html'
import { genIf } from './if'
import { genSetModelValue } from './modelValue'
import { genDynamicProps, genSetProp } from './prop'
import { genDeclareOldRef, genSetTemplateRef } from './templateRef'
import { genCreateTextNode, genSetText } from './text'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
} from './utils'
import { genCreateComponent } from './component'
import { genSlotOutlet } from './slotOutlet'
import {
  type SimpleExpressionNode,
  createSimpleExpression,
} from '@vue/compiler-core'
import { NOOP, extend } from '@vue/shared'
import { genExpression } from './expression'
import { walk } from 'estree-walker'
import type { Node } from '@babel/types'
import {
  type ParserOptions as BabelOptions,
  parseExpression,
} from '@babel/parser'
import { isIdentifier } from 'typescript'

export function genOperations(
  opers: OperationNode[],
  context: CodegenContext,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  for (const operation of opers) {
    push(...genOperation(operation, context))
  }
  return frag
}

export function genOperation(
  oper: OperationNode,
  context: CodegenContext,
): CodeFragment[] {
  switch (oper.type) {
    case IRNodeTypes.SET_PROP:
      return genSetProp(oper, context)
    case IRNodeTypes.SET_DYNAMIC_PROPS:
      return genDynamicProps(oper, context)
    case IRNodeTypes.SET_TEXT:
      return genSetText(oper, context)
    case IRNodeTypes.SET_EVENT:
      return genSetEvent(oper, context)
    case IRNodeTypes.SET_DYNAMIC_EVENTS:
      return genSetDynamicEvents(oper, context)
    case IRNodeTypes.SET_HTML:
      return genSetHtml(oper, context)
    case IRNodeTypes.SET_TEMPLATE_REF:
      return genSetTemplateRef(oper, context)
    case IRNodeTypes.SET_MODEL_VALUE:
      return genSetModelValue(oper, context)
    case IRNodeTypes.CREATE_TEXT_NODE:
      return genCreateTextNode(oper, context)
    case IRNodeTypes.INSERT_NODE:
      return genInsertNode(oper, context)
    case IRNodeTypes.PREPEND_NODE:
      return genPrependNode(oper, context)
    case IRNodeTypes.IF:
      return genIf(oper, context)
    case IRNodeTypes.FOR:
      return genFor(oper, context)
    case IRNodeTypes.CREATE_COMPONENT_NODE:
      return genCreateComponent(oper, context)
    case IRNodeTypes.DECLARE_OLD_REF:
      return genDeclareOldRef(oper)
    case IRNodeTypes.SLOT_OUTLET_NODE:
      return genSlotOutlet(oper, context)
    case IRNodeTypes.WITH_DIRECTIVE:
      return [] // TODO
    default:
      const exhaustiveCheck: never = oper
      throw new Error(
        `Unhandled operation type in genOperation: ${exhaustiveCheck}`,
      )
  }
}

export function genEffects(
  effects: IREffect[],
  context: CodegenContext,
): CodeFragment[] {
  const {
    helper,
    block: { expressions },
  } = context
  const [frag, push, unshift] = buildCodeFragment()
  let operationsCount = 0
  const { ids, frag: declareFrags } = processExpressions(context, expressions)
  push(...declareFrags)
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]
    operationsCount += effect.operations.length
    const frags = context.withId(() => genEffect(effect, context), ids)
    i > 0 && push(NEWLINE)
    if (frag[frag.length - 1] === ')' && frags[0] === '(') {
      push(';')
    }
    push(...frags)
  }

  const newLineCount = frag.filter(frag => frag === NEWLINE).length
  if (newLineCount > 1 || operationsCount > 1 || declareFrags.length > 0) {
    unshift(`{`, INDENT_START, NEWLINE)
    push(INDENT_END, NEWLINE, '}')
  }

  if (effects.length) {
    unshift(NEWLINE, `${helper('renderEffect')}(() => `)
    push(`)`)
  }

  return frag
}

export function genEffect(
  { operations }: IREffect,
  context: CodegenContext,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  const operationsExps = genOperations(operations, context)
  const newlineCount = operationsExps.filter(frag => frag === NEWLINE).length

  if (newlineCount > 1) {
    push(...operationsExps)
  } else {
    push(...operationsExps.filter(frag => frag !== NEWLINE))
  }

  return frag
}

type Declaration = {
  ids: Record<string, string>
  frag: CodeFragment[]
}

type DeclarationValue = {
  replacement: string
  isIdentifier?: boolean
  value: SimpleExpressionNode
}

function processExpressions(
  context: CodegenContext,
  expressions: SimpleExpressionNode[],
): Declaration {
  // 1. extract identifiers and member expressions
  const { seenVariable, variableToExpMap, seenIdentifiers } =
    analyzeExpressions(expressions)
  // 2. handle identifiers and member expressions that appear more than once
  // foo + obj.bar -> _foo + _obj.bar
  const declarations = processRepeatedVariables(
    context,
    seenVariable,
    variableToExpMap,
    seenIdentifiers,
  )
  // 3. after processing identifiers and member expressions, remaining expressions may still contain duplicates
  // for example: `_foo + _obj.bar` may appear multiple times.
  // `_foo + _obj.bar` -> `_foo_obj_bar`
  processRepeatedExpressions(context, expressions, declarations)

  return genDeclarations(declarations, context)
}

function analyzeExpressions(expressions: SimpleExpressionNode[]) {
  const seenVariable: Record<string, number> = Object.create(null)
  const variableToExpMap = new Map<string, Set<SimpleExpressionNode>>()
  const seenIdentifiers = new Set<string>()

  const registerVariable = (
    name: string,
    exp: SimpleExpressionNode,
    isIdentifier: boolean,
  ) => {
    if (isIdentifier) seenIdentifiers.add(name)
    seenVariable[name] = (seenVariable[name] || 0) + 1
    variableToExpMap.set(
      name,
      (variableToExpMap.get(name) || new Set()).add(exp),
    )
  }

  for (const exp of expressions) {
    if (!exp.ast) {
      exp.ast === null && registerVariable(exp.content, exp, true)
      continue
    }

    walk(exp.ast, {
      enter(currentNode: Node) {
        if (currentNode.type === 'MemberExpression') {
          const memberExp = getMemberExp(currentNode, (name: string) => {
            registerVariable(name, exp, true)
          })
          registerVariable(memberExp, exp, false)
          return this.skip()
        }

        if (currentNode.type === 'Identifier') {
          registerVariable(currentNode.name, exp, true)
        }
      },
    })
  }

  return { seenVariable, seenIdentifiers, variableToExpMap }
}

function processRepeatedVariables(
  context: CodegenContext,
  seenVariable: Record<string, number>,
  variableToExpMap: Map<string, Set<SimpleExpressionNode>>,
  seenIdentifiers: Set<string>,
): DeclarationValue[] {
  const declarations: DeclarationValue[] = []
  for (const [key, values] of variableToExpMap) {
    if (seenVariable[key]! > 1 && values.size > 0) {
      const varName = genVarName(key)
      const isIdentifier = seenIdentifiers.has(key)
      if (!declarations.some(d => d.replacement === varName)) {
        declarations.push({
          replacement: varName,
          isIdentifier,
          value: extend(
            { ast: isIdentifier ? null : parseExp(context, key) },
            createSimpleExpression(key),
          ),
        })
      }
      const replaceRE = new RegExp(escapeRegExp(key), 'g')
      values.forEach(node => {
        node.content = node.content.replace(replaceRE, varName)
        node.ast = parseExp(context, node.content)
      })
    }
  }

  return declarations
}

function processRepeatedExpressions(
  context: CodegenContext,
  expressions: SimpleExpressionNode[],
  declarations: DeclarationValue[],
): void {
  const seenExps: Record<string, number> = Object.create(null)
  expressions.forEach(exp => {
    if (exp.ast && exp.ast.type !== 'Identifier') {
      seenExps[exp.content] = (seenExps[exp.content] || 0) + 1
    }
  })
  expressions.forEach(exp => {
    if (
      exp.ast &&
      exp.ast.type !== 'Identifier' &&
      seenExps[exp.content]! > 1
    ) {
      const originalContent = exp.content
      const varName = genVarName(originalContent)
      exp.content = varName
      exp.ast = parseExp(context, exp.content)
      if (!declarations.some(d => d.replacement === varName)) {
        declarations.push({
          replacement: varName,
          value: extend(
            { ast: parseExp(context, originalContent) },
            createSimpleExpression(originalContent),
          ),
        })
      }
    }
  })
}

function genDeclarations(
  declarations: DeclarationValue[],
  context: CodegenContext,
): Declaration {
  const [frag, push] = buildCodeFragment()
  const ids: Record<string, string> = Object.create(null)

  // process identifiers first because expressions may reference identifiers
  declarations.forEach(({ replacement, isIdentifier, value }) => {
    if (isIdentifier) {
      const prefixedName = `_${replacement}`
      ids[replacement] = prefixedName
      push(
        `const ${prefixedName} = `,
        ...genExpression(value, context),
        NEWLINE,
      )
    }
  })

  // process expressions
  declarations.forEach(({ replacement, isIdentifier, value }) => {
    if (!isIdentifier) {
      const prefixedName = `_${replacement}`
      ids[replacement] = prefixedName
      const expFrag = context.withId(() => genExpression(value, context), ids)
      push(`const ${prefixedName} = `, ...expFrag, NEWLINE)
    }
  })

  return { ids, frag }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseExp(context: CodegenContext, content: string): Node {
  const plugins = context.options.expressionPlugins
  const options: BabelOptions = {
    plugins: plugins ? [...plugins, 'typescript'] : ['typescript'],
  }
  return parseExpression(`(${content})`, options)
}

function genVarName(exp: string): string {
  return `${exp
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/_+$/, '')}`
}

function getMemberExp(
  expr: Node,
  onIdentifier: (name: string) => void,
): string {
  if (!expr) return ''
  switch (expr.type) {
    case 'Identifier': // foo[bar]
      onIdentifier(expr.name)
      return expr.name
    case 'StringLiteral': // foo['bar']
      return expr.extra ? (expr.extra.raw as string) : expr.value
    case 'NumericLiteral': // foo[0]
      return expr.value.toString()
    case 'BinaryExpression': // foo[bar + 1]
      return `${getMemberExp(expr.left, onIdentifier)} ${expr.operator} ${getMemberExp(expr.right, onIdentifier)}`
    case 'CallExpression': // foo[bar(baz)]
      return `${getMemberExp(expr.callee, onIdentifier)}(${expr.arguments.map(arg => getMemberExp(arg, onIdentifier)).join(', ')})`
    case 'MemberExpression': // foo[bar.baz]
      const object = getMemberExp(expr.object, onIdentifier)
      const prop = expr.computed
        ? `[${getMemberExp(expr.property, onIdentifier)}]`
        : `.${getMemberExp(expr.property, NOOP)}`
      return `${object}${prop}`
    default:
      return ''
  }
}
