import { SourceLocation, Position } from './ast'
import { parseScript } from 'meriyah'
import { walk } from 'estree-walker'

// cache node requires
// lazy require dependencies so that they don't end up in rollup's dep graph
// and thus can be tree-shaken in browser builds.
let _parseScript: typeof parseScript
let _walk: typeof walk

export const parseJS: typeof parseScript = (code: string, options: any) => {
  assert(
    !__BROWSER__,
    `Expression AST analysis can only be performed in non-browser builds.`
  )
  const parse = _parseScript || (_parseScript = require('meriyah').parseScript)
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
