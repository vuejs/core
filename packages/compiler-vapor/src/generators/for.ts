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
} from '../ir'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  genCall,
  genFlags,
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
    wrappedRows,
  } = oper

  const sourceExpr = ['() => (', ...genExpression(source, context), ')']
  const plugins = context.options.expressionPlugins
  // key and index are parsed as function params too, so they go through the
  // same destructure walk as value - it reads the bound name off the ast and
  // wires up the default value, if any.
  const idToPathMap = parseValueDestructure(value, context)
  const keyToPathMap = parseValueDestructure(key, context)
  const indexToPathMap = parseValueDestructure(index, context)

  const [depth, exitScope] = context.enterScope()
  const itemVar = `_for_item${depth}`
  const idMap = buildDestructureIdMap(idToPathMap, `${itemVar}.value`, plugins)
  idMap[itemVar] = null

  const args = [itemVar]
  if (key) {
    const keyVar = `_for_key${depth}`
    args.push(`, ${keyVar}`)
    Object.assign(
      idMap,
      buildDestructureIdMap(keyToPathMap, `${keyVar}.value`, plugins),
    )
    idMap[keyVar] = null
  } else if (index) {
    args.push(', _')
  }
  if (index) {
    const indexVar = `_for_index${depth}`
    args.push(`, ${indexVar}`)
    Object.assign(
      idMap,
      buildDestructureIdMap(indexToPathMap, `${indexVar}.value`, plugins),
    )
    idMap[indexVar] = null
  }

  const { selectorPatterns, keyOnlyBindingPatterns, skippedEffectIndexes } =
    matchPatterns(render, keyProp, idMap, context)
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
        ...genBlockContent(
          render,
          context,
          false,
          () => {
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
          },
          skippedEffectIndexes,
        ),
      )
    } else {
      frag.push(...genBlockContent(render, context))
    }
    frag.push(INDENT_END, NEWLINE, '}')
    return frag
  }, idMap)
  exitScope()

  const flags = genForFlags(
    onlyChild,
    component,
    isFragmentBlock(render),
    !component && isSingleNodeBlock(render),
    once,
    slotRoot,
    wrappedRows,
  )

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
      flags,
    ),
    ...onResetCalls,
  ]

  function genCallback(expr: SimpleExpressionNode | undefined) {
    if (!expr) return false
    return context.withId(
      () => [
        ...genAliasParams(value, key, index, context),
        ' => (',
        ...genExpression(expr, context),
        ')',
      ],
      genSimpleIdMap(),
    )
  }

  function genSimpleIdMap() {
    const idMap: Record<string, null> = {}
    const collect = (map: DestructureMap) =>
      map.forEach((_, id) => (idMap[id] = null))
    collect(idToPathMap)
    collect(keyToPathMap)
    collect(indexToPathMap)
    return idMap
  }
}

function genForFlags(
  onlyChild: boolean | undefined,
  component: boolean | undefined,
  isFragment: boolean,
  isSingleNode: boolean,
  once: boolean | undefined,
  slotRoot: boolean | undefined,
  wrappedRows: boolean,
): string | undefined {
  let flags = 0
  const names: string[] = []

  if (onlyChild) {
    flags |= VaporVForFlags.FAST_REMOVE
    names.push('FAST_REMOVE')
  }
  if (component) {
    flags |= VaporVForFlags.IS_COMPONENT
    names.push('IS_COMPONENT')
  }
  if (isFragment) {
    flags |= VaporVForFlags.IS_FRAGMENT
    names.push('IS_FRAGMENT')
  }
  if (isSingleNode) {
    flags |= VaporVForFlags.IS_SINGLE_NODE
    names.push('IS_SINGLE_NODE')
  }
  if (once) {
    flags |= VaporVForFlags.ONCE
    names.push('ONCE')
  }
  if (slotRoot) {
    flags |= VaporVForFlags.SLOT_ROOT
    names.push('SLOT_ROOT')
  }
  if (wrappedRows) {
    flags |= VaporVForFlags.WRAPPED_ROWS
    names.push('WRAPPED_ROWS')
  }

  if (!flags) {
    return undefined
  }

  return genFlags(flags, names)
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

export function genAliasParams(
  value: SimpleExpressionNode | undefined,
  key: SimpleExpressionNode | undefined,
  index: SimpleExpressionNode | undefined,
  context: CodegenContext,
): CodeFragment[] {
  return genMulti(
    ['(', ')', ', '],
    value
      ? genExpression(value, context, undefined, true)
      : key || index
        ? '_'
        : undefined,
    key
      ? genExpression(key, context, undefined, true)
      : index
        ? '__'
        : undefined,
    index && genExpression(index, context, undefined, true),
  )
}

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

              // default value, either inside the pattern (`{ a = 1 }`) or on
              // the alias itself (`(item, key, index = 0)`) - the latter sits
              // directly under the arrow the alias is parsed as
              if (
                child.type === 'AssignmentPattern' &&
                (parent.type === 'ObjectProperty' ||
                  parent.type === 'ArrayPattern' ||
                  (parent.type === 'ArrowFunctionExpression' &&
                    child.left === id))
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
  let skippedEffectIndexes: Set<number> | undefined

  if (keyProp === undefined) {
    return {
      keyOnlyBindingPatterns,
      selectorPatterns,
      skippedEffectIndexes,
    }
  }

  for (let index = 0; index < render.effect.length; index++) {
    const effect = render.effect[index]
    const selector = matchSelectorPattern(
      effect,
      keyProp.content,
      idMap,
      context,
    )
    if (selector) {
      selectorPatterns.push(selector)
      skipEffect(index)
      continue
    }
    const keyOnly = matchKeyOnlyBindingPattern(effect, keyProp.content)
    if (keyOnly) {
      keyOnlyBindingPatterns.push(keyOnly)
      skipEffect(index)
    }
  }

  return {
    keyOnlyBindingPatterns,
    selectorPatterns,
    skippedEffectIndexes,
  }

  function skipEffect(index: number): void {
    if (!skippedEffectIndexes) {
      skippedEffectIndexes = new Set()
    }
    skippedEffectIndexes.add(index)
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
              // must be the key itself, not an expression derived from it
              const aIsKey = content.slice(a.start! - 1, a.end! - 1) === key
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
