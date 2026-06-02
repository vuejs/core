import {
  type SimpleExpressionNode,
  createSimpleExpression,
  walkIdentifiers,
} from '@vue/compiler-dom'
import { genBlockContent } from './block'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import {
  type BlockIRNode,
  type ForIRNode,
  type IRDynamicInfo,
  type IREffect,
  IRNodeTypes,
  isBlockOperation,
} from '../ir'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  genCall,
  genMulti,
  getParserOptions,
} from './utils'
import type { Expression, Identifier, Node } from '@babel/types'
import { parseExpression } from '@babel/parser'
import { walk } from 'estree-walker'
import { genOperation } from './operation'
import { VaporVForFlags, isGloballyAllowed } from '@vue/shared'

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
    slotRoot,
  } = oper

  const rawValue = value && value.content
  const rawKey = key && key.content
  const rawIndex = index && index.content

  const sourceExpr = ['() => (', ...genExpression(source, context), ')']
  const idToPathMap = parseValueDestructure(value, context)

  const [depth, exitScope] = context.enterScope()
  const itemVar = `_for_item${depth}`
  const idMap = buildDestructureIdMap(
    idToPathMap,
    `${itemVar}.value`,
    context.options.expressionPlugins,
  )
  idMap[itemVar] = null

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
    context,
  )
  const selectorDeclarations: CodeFragment[] = []
  const selectorName = (i: number) =>
    selectorPatterns.length > 1 ? `_selector${id}_${i}` : `_selector${id}`

  for (let i = 0; i < selectorPatterns.length; i++) {
    const { selector } = selectorPatterns[i]
    selectorDeclarations.push(
      `const ${selectorName(i)} = `,
      ...genCall(helper('createSelector'), [
        `() => `,
        ...genExpression(selector, context),
      ]),
      NEWLINE,
    )
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
              `${selectorName(i)}(`,
              ...genExpression(keyProp!, context),
              `, () => {`,
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
  if (isFragmentBlock(render)) {
    flags |= VaporVForFlags.IS_FRAGMENT
  }
  if (!component && isSingleNodeBlock(render)) {
    flags |= VaporVForFlags.IS_SINGLE_NODE
  }
  if (once) {
    flags |= VaporVForFlags.ONCE
  }
  if (slotRoot) {
    flags |= VaporVForFlags.SLOT_ROOT
  }

  const onResetCalls: CodeFragment[] = []
  for (let i = 0; i < selectorPatterns.length; i++) {
    onResetCalls.push(NEWLINE, `n${id}.onReset(${selectorName(i)}.reset)`)
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
      // todo: hydrationNode
    ),
    ...onResetCalls,
  ]

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

function isSingleNodeBlock(block: BlockIRNode): boolean {
  const child = getSingleReturnedChild(block)
  return !!child && child.template != null
}

function isFragmentBlock(block: BlockIRNode): boolean {
  const child = getSingleReturnedChild(block)
  const operation = child && child.operation
  if (!operation) return false
  return (
    // <slot/>
    operation.type === IRNodeTypes.SLOT_OUTLET_NODE ||
    // <template v-for> with a single v-for child
    operation.type === IRNodeTypes.FOR ||
    // <template v-for> with a single dynamic :key child
    operation.type === IRNodeTypes.KEY ||
    // <template v-for> with a single dynamic v-if child
    (operation.type === IRNodeTypes.IF && !operation.once) ||
    // <component :is="..."/>
    (operation.type === IRNodeTypes.CREATE_COMPONENT_NODE &&
      !!operation.dynamic &&
      !operation.dynamic.isStatic)
  )
}

function getSingleReturnedChild(block: BlockIRNode): IRDynamicInfo | undefined {
  if (block.returns.length !== 1) return
  const id = block.returns[0]
  for (const child of block.dynamic.children) {
    if (child.id === id) return child
  }
}

export type DestructureMapValue = {
  path: string
  dynamic: boolean
  helper?: string
  helperArgs?: string
}

export type DestructureMap = Map<string, DestructureMapValue | null>

// construct a id -> accessor path map.
// e.g. `{ x: { y: [z] }}` -> `Map{ 'z' => '.x.y[0]' }`
export function parseValueDestructure(
  value: SimpleExpressionNode | undefined,
  context: CodegenContext,
): DestructureMap {
  const map: DestructureMap = new Map()
  if (value) {
    const rawValue = value.content
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

              if (parent.type === 'ObjectProperty' && parent.value === child) {
                if (parent.key.type === 'StringLiteral') {
                  path += `[${JSON.stringify(parent.key.value)}]`
                } else if (parent.computed) {
                  isDynamic = true
                  path += `[${rawValue.slice(
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
                        return rawValue.slice(p.key.start! - 1, p.key.end! - 1)
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
                helperArgs = `() => (${rawValue.slice(
                  child.right.start! - 1,
                  child.right.end! - 1,
                )})`
              }
            }
            map.set(id.name, { path, dynamic: isDynamic, helper, helperArgs })
          }
        },
        true,
      )
    } else if (rawValue) {
      map.set(rawValue, null)
    }
  }
  return map
}

export function buildDestructureIdMap(
  idToPathMap: DestructureMap,
  baseAccessor: string,
  plugins: CodegenContext['options']['expressionPlugins'],
): Record<string, string | SimpleExpressionNode | null> {
  const idMap: Record<string, string | SimpleExpressionNode | null> = {}
  idToPathMap.forEach((pathInfo, id) => {
    let path = baseAccessor
    if (pathInfo) {
      path = `${baseAccessor}${pathInfo.path}`

      if (pathInfo.helper) {
        idMap[pathInfo.helper] = null
        path = pathInfo.helperArgs
          ? `${pathInfo.helper}(${path}, ${pathInfo.helperArgs})`
          : `${pathInfo.helper}(${path})`
      }

      if (pathInfo.dynamic) {
        const node = (idMap[id] = createSimpleExpression(path))
        node.ast = parseExpression(`(${path})`, getParserOptions(plugins))
      } else {
        idMap[id] = path
      }
    } else {
      idMap[id] = path
    }
  })
  return idMap
}

function matchPatterns(
  render: BlockIRNode,
  keyProp: SimpleExpressionNode | undefined,
  idMap: Record<string, string | SimpleExpressionNode | null>,
  context: CodegenContext,
) {
  const selectorPatterns: NonNullable<
    ReturnType<typeof matchSelectorPattern>
  >[] = []
  const keyOnlyBindingPatterns: NonNullable<
    ReturnType<typeof matchKeyOnlyBindingPattern>
  >[] = []
  const removedEffectIndexes: number[] = []

  render.effect = render.effect.filter((effect, index) => {
    if (keyProp !== undefined) {
      const selector = matchSelectorPattern(
        effect,
        keyProp.content,
        idMap,
        context,
      )
      if (selector) {
        selectorPatterns.push(selector)
        removedEffectIndexes.push(index)
        return false
      }
      const keyOnly = matchKeyOnlyBindingPattern(effect, keyProp.content)
      if (keyOnly) {
        keyOnlyBindingPatterns.push(keyOnly)
        removedEffectIndexes.push(index)
        return false
      }
    }

    return true
  })

  if (removedEffectIndexes.length) {
    shiftEffectBoundaries(render.dynamic, removedEffectIndexes)
  }

  return {
    keyOnlyBindingPatterns,
    selectorPatterns,
  }
}

function shiftEffectBoundaries(
  dynamic: IRDynamicInfo,
  removedEffectIndexes: number[],
): void {
  const operation = dynamic.operation
  if (
    operation &&
    isBlockOperation(operation) &&
    operation.effectIndex !== undefined
  ) {
    let offset = 0
    for (const removedIndex of removedEffectIndexes) {
      if (removedIndex < operation.effectIndex) {
        offset++
      } else {
        break
      }
    }
    operation.effectIndex -= offset
  }

  for (const child of dynamic.children) {
    shiftEffectBoundaries(child, removedEffectIndexes)
  }
}

function matchKeyOnlyBindingPattern(
  effect: IREffect,
  key: string,
):
  | {
      effect: IREffect
    }
  | undefined {
  // TODO: expressions can be multiple?
  if (effect.expressions.length === 1) {
    const { ast, content } = effect.expressions[0]
    if (typeof ast === 'object' && ast !== null) {
      if (isKeyOnlyBinding(ast, key, content)) {
        return { effect }
      }
    }
  }
}

function matchSelectorPattern(
  effect: IREffect,
  key: string,
  idMap: Record<string, string | SimpleExpressionNode | null>,
  context: CodegenContext,
):
  | {
      effect: IREffect
      selector: SimpleExpressionNode
    }
  | undefined {
  // TODO: expressions can be multiple?
  if (effect.expressions.length === 1) {
    const { ast, content } = effect.expressions[0]
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
              const aIsKey = isKeyOnlyBinding(a, key, content)
              const bIsKey = isKeyOnlyBinding(b, key, content)
              const bVars = analyzeVariableScopes(b, idMap)
              if (aIsKey && !bIsKey && !bVars.length) {
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
        walkIdentifiers(
          ast,
          id => {
            if (id.start !== key.start && id.start !== selector.start) {
              hasExtraId = true
            }
          },
          false,
        )

        if (!hasExtraId) {
          const name = content.slice(selector.start! - 1, selector.end! - 1)
          const selectorExpression = createSimpleExpression(
            name,
            false,
            selector.loc as any,
          )
          selectorExpression.ast = parseExpression(
            `(${name})`,
            getParserOptions(context.options.expressionPlugins),
          )
          return {
            effect,
            selector: selectorExpression,
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
  let locals: string[] = []

  const ids: Identifier[] = []
  walkIdentifiers(
    ast,
    id => {
      ids.push(id)
    },
    false,
  )

  for (const id of ids) {
    if (isGloballyAllowed(id.name)) {
      continue
    }
    if (idMap[id.name]) {
      locals.push(id.name)
    }
  }

  return locals
}

function isKeyOnlyBinding(expr: Node, key: string, source: string) {
  let only = true
  walk(expr, {
    enter(node) {
      if (source.slice(node.start! - 1, node.end! - 1) === key) {
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
