import { TextModes, ParserOptions } from './parser'
import { ElementNode, Namespaces, Position, Node } from './ast'
import { ParserErrorTypes } from './errorTypes'

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
      `${messages[code]} (${loc.line}:${loc.column})`
    )
    error.code = code
    error.loc = loc
    throw error
  },

  transform(node: Node): Node {
    return node
  }
}

const messages: { [code: number]: string } = {
  [ParserErrorTypes.ABRUPT_CLOSING_OF_EMPTY_COMMENT]: 'Illegal comment.',
  [ParserErrorTypes.ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE]:
    'Illegal numeric character reference: invalid character.',
  [ParserErrorTypes.CDATA_IN_HTML_CONTENT]:
    'CDATA section is allowed only in XML context.',
  [ParserErrorTypes.CHARACTER_REFERENCE_OUTSIDE_UNICODE_RANGE]:
    'Illegal numeric character reference: too big.',
  [ParserErrorTypes.CONTROL_CHARACTER_REFERENCE]:
    'Illegal numeric character reference: control character.',
  [ParserErrorTypes.DUPLICATE_ATTRIBUTE]: 'Duplicate attribute.',
  [ParserErrorTypes.END_TAG_WITH_ATTRIBUTES]: 'End tag cannot have attributes.',
  [ParserErrorTypes.END_TAG_WITH_TRAILING_SOLIDUS]: "Illegal '/' in tags.",
  [ParserErrorTypes.EOF_BEFORE_TAG_NAME]: 'Unexpected EOF in tag.',
  [ParserErrorTypes.EOF_IN_CDATA]: 'Unexpected EOF in CDATA section.',
  [ParserErrorTypes.EOF_IN_COMMENT]: 'Unexpected EOF in comment.',
  [ParserErrorTypes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT]:
    'Unexpected EOF in script.',
  [ParserErrorTypes.EOF_IN_TAG]: 'Unexpected EOF in tag.',
  [ParserErrorTypes.INCORRECTLY_CLOSED_COMMENT]: 'Incorrectly closed comment.',
  [ParserErrorTypes.INCORRECTLY_OPENED_COMMENT]: 'Incorrectly opened comment.',
  [ParserErrorTypes.INVALID_FIRST_CHARACTER_OF_TAG_NAME]:
    "Illegal tag name. Use '&lt;' to print '<'.",
  [ParserErrorTypes.MISSING_ATTRIBUTE_VALUE]: 'Attribute value was expected.',
  [ParserErrorTypes.MISSING_END_TAG_NAME]: 'End tag name was expected.',
  [ParserErrorTypes.MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE]:
    'Semicolon was expected.',
  [ParserErrorTypes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES]:
    'Whitespace was expected.',
  [ParserErrorTypes.NESTED_COMMENT]: "Unexpected '<!--' in comment.",
  [ParserErrorTypes.NONCHARACTER_CHARACTER_REFERENCE]:
    'Illegal numeric character reference: non character.',
  [ParserErrorTypes.NULL_CHARACTER_REFERENCE]:
    'Illegal numeric character reference: null character.',
  [ParserErrorTypes.SURROGATE_CHARACTER_REFERENCE]:
    'Illegal numeric character reference: non-pair surrogate.',
  [ParserErrorTypes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME]:
    'Attribute name cannot contain U+0022 ("), U+0027 (\'), and U+003C (<).',
  [ParserErrorTypes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE]:
    'Unquoted attribute value cannot contain U+0022 ("), U+0027 (\'), U+003C (<), U+003D (=), and U+0060 (`).',
  [ParserErrorTypes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME]:
    "Attribute name cannot start with '='.",
  [ParserErrorTypes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME]:
    "'<?' is allowed only in XML context.",
  [ParserErrorTypes.UNEXPECTED_SOLIDUS_IN_TAG]: "Illegal '/' in tags.",
  [ParserErrorTypes.UNKNOWN_NAMED_CHARACTER_REFERENCE]: 'Unknown entity name.',
  [ParserErrorTypes.X_INVALID_END_TAG]: 'Invalid end tag.',
  [ParserErrorTypes.X_MISSING_END_TAG]: 'End tag was not found.',
  [ParserErrorTypes.X_MISSING_INTERPOLATION_END]:
    'Interpolation end sign was not found.'
}
