import {
  type SimpleExpressionNode,
  createSimpleExpression,
  walkIdentifiers,
} from '@vue/compiler-dom'
import { genBlock } from './block'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { ForIRNode } from '../ir'
import { type CodeFragment, NEWLINE, genCall, genMulti } from './utils'
import type { Identifier } from '@babel/types'
import { parseExpression } from '@babel/parser'

export function genFor(
  oper: ForIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const { source, value, key, index, render, keyProp, once, id, component } =
    oper

  let rawValue: string | null = null
  const rawKey = key && key.content
  const rawIndex = index && index.content

  const sourceExpr = ['() => (', ...genExpression(source, context), ')']
  const idToPathMap = parseValueDestructure()

  const [depth, exitScope] = context.enterScope()
  const propsName = `_ctx${depth}`
  const idMap: Record<string, string | SimpleExpressionNode | null> = {}

  idToPathMap.forEach((pathInfo, id) => {
    let path = `${propsName}[0].value${pathInfo ? pathInfo.path : ''}`
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
  if (rawKey) idMap[rawKey] = `${propsName}[1].value`
  if (rawIndex) idMap[rawIndex] = `${propsName}[2].value`

  const blockFn = context.withId(
    () => genBlock(render, context, [propsName]),
    idMap,
  )
  exitScope()

  return [
    NEWLINE,
    `const n${id} = `,
    ...genCall(
      helper('createFor'),
      sourceExpr,
      blockFn,
      genCallback(keyProp),
      component && 'true',
      once && 'true',
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
