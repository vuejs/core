import { TextModes, ParserOptions } from './parser'
import { ElementNode, Namespaces, Position, Node } from './ast'
import { ParserErrorTypes, errorMessages } from './errorTypes'

export const parserOptionsMinimal: ParserOptions = {
  delimiters: [`{{`, `}}`],
  ignoreSpaces: true,

  getNamespace(tag: string, parent: ElementNode | undefined): Namespaces {
    const ns = parent ? parent.ns : Namespaces.HTML
    if (ns === Namespaces.HTML) {
      if (tag === 'svg') {
        return Namespaces.SVG
      }
      if (tag === 'math') {
        return Namespaces.MATH_ML
      }
    }
    return ns
  },

  getTextMode(tag: string, ns: Namespaces): TextModes {
    if (ns === Namespaces.HTML) {
      if (/^textarea$/i.test(tag)) {
        return TextModes.RCDATA
      }
      if (/^(?:style|script)$/i.test(tag)) {
        return TextModes.RAWTEXT
      }
    }
    return TextModes.DATA
  },

  isVoidTag(tag: string): boolean {
    return /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(
      tag
    )
  },

  namedCharacterReferences: {
    'gt;': '>',
    'lt;': '<',
    'amp;': '&',
    'apos;': "'",
    'quot;': '"'
  },

  onError(code: ParserErrorTypes, loc: Position): void {
    const error: any = new SyntaxError(
      `${errorMessages[code]} (${loc.line}:${loc.column})`
    )
    error.code = code
    error.loc = loc
    throw error
  },

  transform(node: Node): Node {
    return node
  }
}
