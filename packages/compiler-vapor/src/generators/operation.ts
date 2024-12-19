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
import { type ParserOptions, parseExpression } from '@babel/parser'

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
  const { ids, frag: declarationFrags } = processExpressions(
    context,
    expressions,
  )
  push(...declarationFrags)
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
  if (newLineCount > 1 || operationsCount > 1 || declarationFrags.length > 0) {
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

type DeclarationResult = {
  ids: Record<string, string>
  frag: CodeFragment[]
}

type DeclarationValue = {
  name: string
  isIdentifier?: boolean
  value: SimpleExpressionNode
}

function processExpressions(
  context: CodegenContext,
  expressions: SimpleExpressionNode[],
): DeclarationResult {
  // analyze variables
  const { seenVariable, variableToExpMap, seenIdentifier } =
    analyzeExpressions(expressions)

  // process repeated identifiers and member expressions
  // e.g., `foo[baz]` will be transformed into `foo_baz`
  const varDeclarations = processRepeatedVariables(
    context,
    seenVariable,
    variableToExpMap,
    seenIdentifier,
  )

  // process duplicate expressions after identifier and member expression handling.
  // e.g., `foo + bar` will be transformed into `foo_bar`
  const expDeclarations = processRepeatedExpressions(context, expressions)

  return genDeclarations([...varDeclarations, ...expDeclarations], context)
}

function analyzeExpressions(expressions: SimpleExpressionNode[]) {
  const seenVariable: Record<string, number> = Object.create(null)
  const variableToExpMap = new Map<string, Set<SimpleExpressionNode>>()
  const seenIdentifier = new Set<string>()

  const registerVariable = (
    name: string,
    exp: SimpleExpressionNode,
    isIdentifier: boolean,
  ) => {
    if (isIdentifier) seenIdentifier.add(name)
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
          const memberExp = extractMemberExpression(
            currentNode,
            (name: string) => {
              registerVariable(name, exp, true)
            },
          )
          registerVariable(memberExp, exp, false)
          return this.skip()
        }

        if (currentNode.type === 'Identifier') {
          registerVariable(currentNode.name, exp, true)
        }
      },
    })
  }

  return { seenVariable, seenIdentifier, variableToExpMap }
}

function processRepeatedVariables(
  context: CodegenContext,
  seenVariable: Record<string, number>,
  variableToExpMap: Map<string, Set<SimpleExpressionNode>>,
  seenIdentifier: Set<string>,
): DeclarationValue[] {
  const declarations: DeclarationValue[] = []
  for (const [name, exps] of variableToExpMap) {
    if (seenVariable[name] > 1 && exps.size > 0) {
      const isIdentifier = seenIdentifier.has(name)
      const varName = genVarName(name)
      if (!declarations.some(d => d.name === varName)) {
        declarations.push({
          name: varName,
          isIdentifier,
          value: extend(
            { ast: isIdentifier ? null : parseExp(context, name) },
            createSimpleExpression(name),
          ),
        })
      }

      // replaces all non-identifiers with the new name. if node content
      // includes only one member expression, it will become an identifier,
      // e.g., foo[baz] -> foo_baz.
      // for identifiers, we don't need to replace the content - they will be
      // replaced during context.withId(..., ids)
      const replaceRE = new RegExp(escapeRegExp(name), 'g')
      exps.forEach(node => {
        if (node.ast) {
          node.content = node.content.replace(replaceRE, varName)
          // re-parse the expression
          node.ast = parseExp(context, node.content)
        }
      })
    }
  }

  return declarations
}

function processRepeatedExpressions(
  context: CodegenContext,
  expressions: SimpleExpressionNode[],
): DeclarationValue[] {
  const declarations: DeclarationValue[] = []
  const seenExp = expressions.reduce(
    (acc, exp) => {
      // only handle expressions that are not identifiers
      if (exp.ast && exp.ast.type !== 'Identifier') {
        acc[exp.content] = (acc[exp.content] || 0) + 1
      }
      return acc
    },
    Object.create(null) as Record<string, number>,
  )

  Object.entries(seenExp).forEach(([content, count]) => {
    if (count > 1) {
      const varName = genVarName(content)
      if (!declarations.some(d => d.name === varName)) {
        declarations.push({
          name: varName,
          value: extend({}, expressions.find(exp => exp.content === content)!),
        })
      }

      // assume content equals to `foo + baz`
      expressions.forEach(exp => {
        // foo + baz -> foo_baz
        if (exp.content === content) {
          exp.content = varName
          // ast is no longer needed since it becomes an identifier.
          exp.ast = null
        }
        // foo + foo + baz -> foo + foo_baz
        else if (exp.content.includes(content)) {
          exp.content = exp.content.replace(
            new RegExp(escapeRegExp(content), 'g'),
            varName,
          )
          // re-parse the expression
          exp.ast = parseExp(context, exp.content)
        }
      })
    }
  })

  return declarations
}

function genDeclarations(
  declarations: DeclarationValue[],
  context: CodegenContext,
): DeclarationResult {
  const [frag, push] = buildCodeFragment()
  const ids: Record<string, string> = Object.create(null)

  // process identifiers first as expressions may rely on them
  declarations.forEach(({ name, isIdentifier, value }) => {
    if (isIdentifier) {
      const varName = (ids[name] = `_${name}`)
      push(`const ${varName} = `, ...genExpression(value, context), NEWLINE)
    }
  })

  // process expressions
  declarations.forEach(({ name, isIdentifier, value }) => {
    if (!isIdentifier) {
      const varName = (ids[name] = `_${name}`)
      push(
        `const ${varName} = `,
        ...context.withId(() => genExpression(value, context), ids),
        NEWLINE,
      )
    }
  })

  return { ids, frag }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseExp(context: CodegenContext, content: string): Node {
  const plugins = context.options.expressionPlugins
  const options: ParserOptions = {
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

function extractMemberExpression(
  exp: Node,
  onIdentifier: (name: string) => void,
): string {
  if (!exp) return ''
  switch (exp.type) {
    case 'Identifier': // foo[bar]
      onIdentifier(exp.name)
      return exp.name
    case 'StringLiteral': // foo['bar']
      return exp.extra ? (exp.extra.raw as string) : exp.value
    case 'NumericLiteral': // foo[0]
      return exp.value.toString()
    case 'BinaryExpression': // foo[bar + 1]
      return `${extractMemberExpression(exp.left, onIdentifier)} ${exp.operator} ${extractMemberExpression(exp.right, onIdentifier)}`
    case 'CallExpression': // foo[bar(baz)]
      return `${extractMemberExpression(exp.callee, onIdentifier)}(${exp.arguments.map(arg => extractMemberExpression(arg, onIdentifier)).join(', ')})`
    case 'MemberExpression': // foo[bar.baz]
      const object = extractMemberExpression(exp.object, onIdentifier)
      const prop = exp.computed
        ? `[${extractMemberExpression(exp.property, onIdentifier)}]`
        : `.${extractMemberExpression(exp.property, NOOP)}`
      return `${object}${prop}`
    default:
      return ''
  }
}
