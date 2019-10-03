import {
  SourceLocation,
  Position,
  ElementNode,
  NodeTypes,
  CallExpression,
  SequenceExpression,
  createSequenceExpression,
  createCallExpression,
  DirectiveNode,
  ElementTypes,
  TemplateChildNode,
  RootNode
} from './ast'
import { parse } from 'acorn'
import { walk } from 'estree-walker'
import { TransformContext } from './transform'
import { OPEN_BLOCK, CREATE_BLOCK } from './runtimeConstants'
import { isString } from '@vue/shared'

// cache node requires
// lazy require dependencies so that they don't end up in rollup's dep graph
// and thus can be tree-shaken in browser builds.
let _parse: typeof parse
let _walk: typeof walk

export const parseJS: typeof parse = (code: string, options: any) => {
  assert(
    !__BROWSER__,
    `Expression AST analysis can only be performed in non-browser builds.`
  )
  const parse = _parse || (_parse = require('acorn').parse)
  return parse(code, options)
}

export const walkJS: typeof walk = (ast, walker) => {
  assert(
    !__BROWSER__,
    `Expression AST analysis can only be performed in non-browser builds.`
  )
  const walk = _walk || (_walk = require('estree-walker').walk)
  return walk(ast, walker)
}

export const isSimpleIdentifier = (name: string): boolean =>
  !/^\d|[^\w]/.test(name)

export function getInnerRange(
  loc: SourceLocation,
  offset: number,
  length?: number
): SourceLocation {
  __DEV__ && assert(offset <= loc.source.length)
  const source = loc.source.substr(offset, length)
  const newLoc: SourceLocation = {
    source,
    start: advancePositionWithClone(loc.start, loc.source, offset),
    end: loc.end
  }

  if (length != null) {
    __DEV__ && assert(offset + length <= loc.source.length)
    newLoc.end = advancePositionWithClone(
      loc.start,
      loc.source,
      offset + length
    )
  }

  return newLoc
}

export function advancePositionWithClone(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length
): Position {
  return advancePositionWithMutation({ ...pos }, source, numberOfCharacters)
}

// advance by mutation without cloning (for performance reasons), since this
// gets called a lot in the parser
export function advancePositionWithMutation(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length
): Position {
  let linesCount = 0
  let lastNewLinePos = -1
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10 /* newline char code */) {
      linesCount++
      lastNewLinePos = i
    }
  }

  pos.offset += numberOfCharacters
  pos.line += linesCount
  pos.column =
    lastNewLinePos === -1
      ? pos.column + numberOfCharacters
      : Math.max(1, numberOfCharacters - lastNewLinePos)

  return pos
}

export function assert(condition: boolean, msg?: string) {
  /* istanbul ignore if */
  if (!condition) {
    throw new Error(msg || `unexpected compiler condition`)
  }
}

export function findDir(
  node: ElementNode,
  name: string | RegExp,
  allowEmpty: boolean = false
): DirectiveNode | undefined {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (
      p.type === NodeTypes.DIRECTIVE &&
      (allowEmpty || p.exp) &&
      (isString(name) ? p.name === name : name.test(p.name))
    ) {
      return p
    }
  }
}

export function findProp(
  node: ElementNode,
  name: string
): ElementNode['props'][0] | undefined {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      if (p.name === name && p.value && !p.value.isEmpty) {
        return p
      }
    } else if (
      p.arg &&
      p.arg.type === NodeTypes.SIMPLE_EXPRESSION &&
      p.arg.isStatic &&
      p.arg.content === name &&
      p.exp
    ) {
      return p
    }
  }
}

export function createBlockExpression(
  args: CallExpression['arguments'],
  context: TransformContext
): SequenceExpression {
  return createSequenceExpression([
    createCallExpression(context.helper(OPEN_BLOCK)),
    createCallExpression(context.helper(CREATE_BLOCK), args)
  ])
}

export const isVSlot = (p: ElementNode['props'][0]): p is DirectiveNode =>
  p.type === NodeTypes.DIRECTIVE && p.name === 'slot'

export const isTemplateNode = (
  node: RootNode | TemplateChildNode
): node is ElementNode =>
  node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.TEMPLATE
