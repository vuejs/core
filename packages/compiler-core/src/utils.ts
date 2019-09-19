import { SourceLocation, Position } from './ast'

export function getInnerRange(
  loc: SourceLocation,
  offset: number,
  length?: number
): SourceLocation {
  const source = loc.source.substr(offset, length)
  const newLoc: SourceLocation = {
    source,
    start: advancePositionBy(loc.start, loc.source, offset),
    end: loc.end
  }

  if (length != null) {
    newLoc.end = advancePositionBy(loc.start, loc.source, offset + length)
  }

  return newLoc
}

export function advancePositionBy(
  pos: Position,
  source: string,
  numberOfCharacters: number
): Position {
  __DEV__ && assert(numberOfCharacters <= source.length)

  const newPosition = {
    ...pos
  }

  const str = source.slice(0, numberOfCharacters)
  const lines = str.split(/\r?\n/)

  newPosition.offset += numberOfCharacters
  newPosition.line += lines.length - 1
  newPosition.column =
    lines.length === 1
      ? pos.column + numberOfCharacters
      : Math.max(1, lines.pop()!.length)

  return newPosition
}

export function assert(condition: boolean, msg?: string) {
  if (!condition) {
    throw new Error(msg || `unexpected parser condition`)
  }
}
