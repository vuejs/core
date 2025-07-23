import {
  type SimpleExpressionNode,
  createSimpleExpression,
  isStaticNode,
  walkIdentifiers,
} from '@vue/compiler-dom'
import { genBlockContent } from './block'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { BlockIRNode, ForIRNode, IREffect } from '../ir'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'
import {
  type Expression,
  type Identifier,
  type Node,
  isNodesEquivalent,
} from '@babel/types'
import { parseExpression } from '@babel/parser'
import { VaporVForFlags } from '../../../shared/src/vaporFlags'
import { walk } from 'estree-walker'
import { genOperation } from './operation'
import { extend, isGloballyAllowed } from '@vue/shared'

export function genFor(
  oper: ForIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const {
    source,
    value,
    key,
    index,
    render,
    keyProp,
    once,
    id,
    component,
    onlyChild,
  } = oper

  let rawValue: string | null = null
  const rawKey = key && key.content
  const rawIndex = index && index.content

  const sourceExpr = ['() => (', ...genExpression(source, context), ')']
  const idToPathMap = parseValueDestructure()

  const [depth, exitScope] = context.enterScope()
  const idMap: Record<string, string | SimpleExpressionNode | null> = {}

  const itemVar = `_for_item${depth}`
  idMap[itemVar] = null

  idToPathMap.forEach((pathInfo, id) => {
    let path = `${itemVar}.value${pathInfo ? pathInfo.path : ''}`
    if (pathInfo) {
      if (pathInfo.helper) {
        idMap[pathInfo.helper] = null
        path = `${pathInfo.helper}(${path}, ${pathInfo.helperArgs})`
      }
      if (pathInfo.dynamic) {
        const node = (idMap[id] = createSimpleExpression(path))
        const plugins = context.options.expressionPlugins
        node.ast = parseExpression(`(${path})`, {
          plugins: plugins ? [...plugins, 'typescript'] : ['typescript'],
        })
      } else {
        idMap[id] = path
      }
    } else {
      idMap[id] = path
    }
  })

  const args = [itemVar]
  if (rawKey) {
    const keyVar = `_for_key${depth}`
    args.push(`, ${keyVar}`)
    idMap[rawKey] = `${keyVar}.value`
    idMap[keyVar] = null
  }
  if (rawIndex) {
    const indexVar = `_for_index${depth}`
    args.push(`, ${indexVar}`)
    idMap[rawIndex] = `${indexVar}.value`
    idMap[indexVar] = null
  }

  const { selectorPatterns, keyOnlyBindingPatterns } = matchPatterns(
    render,
    keyProp,
    idMap,
  )
  const selectorDeclarations: CodeFragment[] = []
  const selectorSetup: CodeFragment[] = []

  for (let i = 0; i < selectorPatterns.length; i++) {
    const { selector } = selectorPatterns[i]
    const selectorName = `_selector${id}_${i}`
    selectorDeclarations.push(`let ${selectorName}`, NEWLINE)
    if (i === 0) {
      selectorSetup.push(`({ createSelector }) => {`, INDENT_START)
    }
    selectorSetup.push(
      NEWLINE,
      `${selectorName} = `,
      ...genCall(`createSelector`, [
        `() => `,
        ...genExpression(selector, context),
      ]),
    )
    if (i === selectorPatterns.length - 1) {
      selectorSetup.push(INDENT_END, NEWLINE, '}')
    }
  }

  const blockFn = context.withId(() => {
    const frag: CodeFragment[] = []
    frag.push('(', ...args, ') => {', INDENT_START)
    if (selectorPatterns.length || keyOnlyBindingPatterns.length) {
      frag.push(
        ...genBlockContent(render, context, false, () => {
          const patternFrag: CodeFragment[] = []

          for (let i = 0; i < selectorPatterns.length; i++) {
            const { effect } = selectorPatterns[i]
            patternFrag.push(
              NEWLINE,
              `_selector${id}_${i}(() => {`,
              INDENT_START,
            )
            for (const oper of effect.operations) {
              patternFrag.push(...genOperation(oper, context))
            }
            patternFrag.push(INDENT_END, NEWLINE, `})`)
          }

          for (const { effect } of keyOnlyBindingPatterns) {
            for (const oper of effect.operations) {
              patternFrag.push(...genOperation(oper, context))
            }
          }

          return patternFrag
        }),
      )
    } else {
      frag.push(...genBlockContent(render, context))
    }
    frag.push(INDENT_END, NEWLINE, '}')
    return frag
  }, idMap)
  exitScope()

  let flags = 0
  if (onlyChild) {
    flags |= VaporVForFlags.FAST_REMOVE
  }
  if (component) {
    flags |= VaporVForFlags.IS_COMPONENT
  }
  if (once) {
    flags |= VaporVForFlags.ONCE
  }

  return [
    NEWLINE,
    ...selectorDeclarations,
    `const n${id} = `,
    ...genCall(
      [helper('createFor'), 'undefined'],
      sourceExpr,
      blockFn,
      genCallback(keyProp),
      flags ? String(flags) : undefined,
      selectorSetup.length ? selectorSetup : undefined,
      // todo: hydrationNode
    ),
  ]

  // construct a id -> accessor path map.
  // e.g. `{ x: { y: [z] }}` -> `Map{ 'z' => '.x.y[0]' }`
  function parseValueDestructure() {
    const map = new Map<
      string,
      {
        path: string
        dynamic: boolean
        helper?: string
        helperArgs?: string
      } | null
    >()
    if (value) {
      rawValue = value && value.content
      if (value.ast) {
        walkIdentifiers(
          value.ast,
          (id, _, parentStack, ___, isLocal) => {
            if (isLocal) {
              let path = ''
              let isDynamic = false
              let helper
              let helperArgs
              for (let i = 0; i < parentStack.length; i++) {
                const parent = parentStack[i]
                const child = parentStack[i + 1] || id

                if (
                  parent.type === 'ObjectProperty' &&
                  parent.value === child
                ) {
                  if (parent.key.type === 'StringLiteral') {
                    path += `[${JSON.stringify(parent.key.value)}]`
                  } else if (parent.computed) {
                    isDynamic = true
                    path += `[${value.content.slice(
                      parent.key.start! - 1,
                      parent.key.end! - 1,
                    )}]`
                  } else {
                    // non-computed, can only be identifier
                    path += `.${(parent.key as Identifier).name}`
                  }
                } else if (parent.type === 'ArrayPattern') {
                  const index = parent.elements.indexOf(child as any)
                  if (child.type === 'RestElement') {
                    path += `.slice(${index})`
                  } else {
                    path += `[${index}]`
                  }
                } else if (
                  parent.type === 'ObjectPattern' &&
                  child.type === 'RestElement'
                ) {
                  helper = context.helper('getRestElement')
                  helperArgs =
                    '[' +
                    parent.properties
                      .filter(p => p.type === 'ObjectProperty')
                      .map(p => {
                        if (p.key.type === 'StringLiteral') {
                          return JSON.stringify(p.key.value)
                        } else if (p.computed) {
                          isDynamic = true
                          return value.content.slice(
                            p.key.start! - 1,
                            p.key.end! - 1,
                          )
                        } else {
                          return JSON.stringify((p.key as Identifier).name)
                        }
                      })
                      .join(', ') +
                    ']'
                }

                // default value
                if (
                  child.type === 'AssignmentPattern' &&
                  (parent.type === 'ObjectProperty' ||
                    parent.type === 'ArrayPattern')
                ) {
                  isDynamic = true
                  helper = context.helper('getDefaultValue')
                  helperArgs = value.content.slice(
                    child.right.start! - 1,
                    child.right.end! - 1,
                  )
                }
              }
              map.set(id.name, { path, dynamic: isDynamic, helper, helperArgs })
            }
          },
          true,
        )
      } else {
        map.set(rawValue, null)
      }
    }
    return map
  }

  function genCallback(expr: SimpleExpressionNode | undefined) {
    if (!expr) return false
    const res = context.withId(
      () => genExpression(expr, context),
      genSimpleIdMap(),
    )
    return [
      ...genMulti(
        ['(', ')', ', '],
        rawValue ? rawValue : rawKey || rawIndex ? '_' : undefined,
        rawKey ? rawKey : rawIndex ? '__' : undefined,
        rawIndex,
      ),
      ' => (',
      ...res,
      ')',
    ]
  }

  function genSimpleIdMap() {
    const idMap: Record<string, null> = {}
    if (rawKey) idMap[rawKey] = null
    if (rawIndex) idMap[rawIndex] = null
    idToPathMap.forEach((_, id) => (idMap[id] = null))
    return idMap
  }
}

function matchPatterns(
  render: BlockIRNode,
  keyProp: SimpleExpressionNode | undefined,
  idMap: Record<string, string | SimpleExpressionNode | null>,
) {
  const selectorPatterns: NonNullable<
    ReturnType<typeof matchSelectorPattern>
  >[] = []
  const keyOnlyBindingPatterns: NonNullable<
    ReturnType<typeof matchKeyOnlyBindingPattern>
  >[] = []

  render.effect = render.effect.filter(effect => {
    if (keyProp !== undefined) {
      const selector = matchSelectorPattern(effect, keyProp.ast, idMap)
      if (selector) {
        selectorPatterns.push(selector)
        return false
      }
      const keyOnly = matchKeyOnlyBindingPattern(effect, keyProp.ast)
      if (keyOnly) {
        keyOnlyBindingPatterns.push(keyOnly)
        return false
      }
    }

    return true
  })

  return {
    keyOnlyBindingPatterns,
    selectorPatterns,
  }
}

function matchKeyOnlyBindingPattern(
  effect: IREffect,
  keyAst: any,
):
  | {
      effect: IREffect
    }
  | undefined {
  // TODO: expressions can be multiple?
  if (effect.expressions.length === 1) {
    const ast = effect.expressions[0].ast
    if (typeof ast === 'object' && ast !== null) {
      if (isKeyOnlyBinding(ast, keyAst)) {
        return { effect }
      }
    }
  }
}

function matchSelectorPattern(
  effect: IREffect,
  keyAst: any,
  idMap: Record<string, string | SimpleExpressionNode | null>,
):
  | {
      effect: IREffect
      selector: SimpleExpressionNode
    }
  | undefined {
  // TODO: expressions can be multiple?
  if (effect.expressions.length === 1) {
    const ast = effect.expressions[0].ast
    if (typeof ast === 'object' && ast) {
      const matcheds: [key: Expression, selector: Expression][] = []

      walk(ast, {
        enter(node) {
          if (
            typeof node === 'object' &&
            node &&
            node.type === 'BinaryExpression' &&
            node.operator === '===' &&
            node.left.type !== 'PrivateName'
          ) {
            const { left, right } = node
            for (const [a, b] of [
              [left, right],
              [right, left],
            ]) {
              const aIsKey = isKeyOnlyBinding(a, keyAst)
              const bIsKey = isKeyOnlyBinding(b, keyAst)
              const bVars = analyzeVariableScopes(b, idMap)
              if (aIsKey && !bIsKey && !bVars.locals.length) {
                matcheds.push([a, b])
              }
            }
          }
        },
      })

      if (matcheds.length === 1) {
        const [key, selector] = matcheds[0]
        const content = effect.expressions[0].content

        let hasExtraId = false
        const parentStackMap = new Map<Identifier, Node[]>()
        const parentStack: Node[] = []
        walkIdentifiers(
          ast,
          id => {
            if (id.start !== key.start && id.start !== selector.start) {
              hasExtraId = true
            }
            parentStackMap.set(id, parentStack.slice())
          },
          false,
          parentStack,
        )

        if (!hasExtraId) {
          const name = content.slice(selector.start! - 1, selector.end! - 1)
          return {
            effect,
            // @ts-expect-error
            selector: {
              content: name,
              ast: extend({}, selector, {
                start: 1,
                end: name.length + 1,
              }),
              loc: selector.loc as any,
              isStatic: false,
            },
          }
        }
      }
    }

    const content = effect.expressions[0].content
    if (
      typeof ast === 'object' &&
      ast &&
      ast.type === 'ConditionalExpression' &&
      ast.test.type === 'BinaryExpression' &&
      ast.test.operator === '===' &&
      ast.test.left.type !== 'PrivateName' &&
      isStaticNode(ast.consequent) &&
      isStaticNode(ast.alternate)
    ) {
      const left = ast.test.left
      const right = ast.test.right
      for (const [a, b] of [
        [left, right],
        [right, left],
      ]) {
        const aIsKey = isKeyOnlyBinding(a, keyAst)
        const bIsKey = isKeyOnlyBinding(b, keyAst)
        const bVars = analyzeVariableScopes(b, idMap)
        if (aIsKey && !bIsKey && !bVars.locals.length) {
          return {
            effect,
            // @ts-expect-error
            selector: {
              content: content.slice(b.start! - 1, b.end! - 1),
              ast: b,
              loc: b.loc as any,
              isStatic: false,
            },
          }
        }
      }
    }
  }
}

function analyzeVariableScopes(
  ast: Node,
  idMap: Record<string, string | SimpleExpressionNode | null>,
) {
  let globals: string[] = []
  let locals: string[] = []

  const ids: Identifier[] = []
  const parentStackMap = new Map<Identifier, Node[]>()
  const parentStack: Node[] = []
  walkIdentifiers(
    ast,
    id => {
      ids.push(id)
      parentStackMap.set(id, parentStack.slice())
    },
    false,
    parentStack,
  )

  for (const id of ids) {
    if (isGloballyAllowed(id.name)) {
      continue
    }
    if (idMap[id.name]) {
      locals.push(id.name)
    } else {
      globals.push(id.name)
    }
  }

  return { globals, locals }
}

function isKeyOnlyBinding(expr: Node, keyAst: any) {
  let only = true
  walk(expr, {
    enter(node) {
      if (isNodesEquivalent(node, keyAst)) {
        this.skip()
        return
      }
      if (node.type === 'Identifier') {
        only = false
      }
    },
  })
  return only
}
