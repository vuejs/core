import { SourceLocation } from './ast'

export interface CompilerError extends SyntaxError {
  code: ErrorCodes
  loc?: SourceLocation
}

export function defaultOnError(error: CompilerError) {
  throw error
}

export function createCompilerError(
  code: ErrorCodes,
  loc?: SourceLocation
): CompilerError {
  const msg = __DEV__ || !__BROWSER__ ? errorMessages[code] : code
  const locInfo = loc ? ` (${loc.start.line}:${loc.start.column})` : ``
  const error = new SyntaxError(msg + locInfo) as CompilerError
  error.code = code
  error.loc = loc
  return error
}

export const enum ErrorCodes {
  // parse errors
  ABRUPT_CLOSING_OF_EMPTY_COMMENT,
  ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE,
  CDATA_IN_HTML_CONTENT,
  CHARACTER_REFERENCE_OUTSIDE_UNICODE_RANGE,
  CONTROL_CHARACTER_REFERENCE,
  DUPLICATE_ATTRIBUTE,
  END_TAG_WITH_ATTRIBUTES,
  END_TAG_WITH_TRAILING_SOLIDUS,
  EOF_BEFORE_TAG_NAME,
  EOF_IN_CDATA,
  EOF_IN_COMMENT,
  EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT,
  EOF_IN_TAG,
  INCORRECTLY_CLOSED_COMMENT,
  INCORRECTLY_OPENED_COMMENT,
  INVALID_FIRST_CHARACTER_OF_TAG_NAME,
  MISSING_ATTRIBUTE_VALUE,
  MISSING_END_TAG_NAME,
  MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE,
  MISSING_WHITESPACE_BETWEEN_ATTRIBUTES,
  NESTED_COMMENT,
  NONCHARACTER_CHARACTER_REFERENCE,
  NULL_CHARACTER_REFERENCE,
  SURROGATE_CHARACTER_REFERENCE,
  UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
  UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
  UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME,
  UNEXPECTED_NULL_CHARACTER,
  UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME,
  UNEXPECTED_SOLIDUS_IN_TAG,
  UNKNOWN_NAMED_CHARACTER_REFERENCE,

  // Vue-specific parse errors
  X_INVALID_END_TAG,
  X_MISSING_END_TAG,
  X_MISSING_INTERPOLATION_END,
  X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END,

  // transform errors
  X_IF_NO_EXPRESSION,
  X_ELSE_NO_ADJACENT_IF,
  X_FOR_NO_EXPRESSION,
  X_FOR_MALFORMED_EXPRESSION,
  X_V_BIND_NO_EXPRESSION,
  X_V_ON_NO_EXPRESSION,
  X_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
  X_NAMED_SLOT_ON_COMPONENT,
  X_MIXED_SLOT_USAGE,
  X_DUPLICATE_SLOT_NAMES,
  X_EXTRANEOUS_NON_SLOT_CHILDREN,
  X_MISPLACED_V_SLOT,

  // generic errors
  X_PREFIX_ID_NOT_SUPPORTED,
  X_MODULE_MODE_NOT_SUPPORTED
}

export const errorMessages: { [code: number]: string } = {
  // parse errors
  [ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT]: 'Illegal comment.',
  [ErrorCodes.ABSENCE_OF_DIGITS_IN_NUMERIC_CHARACTER_REFERENCE]:
    'Illegal numeric character reference: invalid character.',
  [ErrorCodes.CDATA_IN_HTML_CONTENT]:
    'CDATA section is allowed only in XML context.',
  [ErrorCodes.CHARACTER_REFERENCE_OUTSIDE_UNICODE_RANGE]:
    'Illegal numeric character reference: too big.',
  [ErrorCodes.CONTROL_CHARACTER_REFERENCE]:
    'Illegal numeric character reference: control character.',
  [ErrorCodes.DUPLICATE_ATTRIBUTE]: 'Duplicate attribute.',
  [ErrorCodes.END_TAG_WITH_ATTRIBUTES]: 'End tag cannot have attributes.',
  [ErrorCodes.END_TAG_WITH_TRAILING_SOLIDUS]: "Illegal '/' in tags.",
  [ErrorCodes.EOF_BEFORE_TAG_NAME]: 'Unexpected EOF in tag.',
  [ErrorCodes.EOF_IN_CDATA]: 'Unexpected EOF in CDATA section.',
  [ErrorCodes.EOF_IN_COMMENT]: 'Unexpected EOF in comment.',
  [ErrorCodes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT]:
    'Unexpected EOF in script.',
  [ErrorCodes.EOF_IN_TAG]: 'Unexpected EOF in tag.',
  [ErrorCodes.INCORRECTLY_CLOSED_COMMENT]: 'Incorrectly closed comment.',
  [ErrorCodes.INCORRECTLY_OPENED_COMMENT]: 'Incorrectly opened comment.',
  [ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME]:
    "Illegal tag name. Use '&lt;' to print '<'.",
  [ErrorCodes.MISSING_ATTRIBUTE_VALUE]: 'Attribute value was expected.',
  [ErrorCodes.MISSING_END_TAG_NAME]: 'End tag name was expected.',
  [ErrorCodes.MISSING_SEMICOLON_AFTER_CHARACTER_REFERENCE]:
    'Semicolon was expected.',
  [ErrorCodes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES]:
    'Whitespace was expected.',
  [ErrorCodes.NESTED_COMMENT]: "Unexpected '<!--' in comment.",
  [ErrorCodes.NONCHARACTER_CHARACTER_REFERENCE]:
    'Illegal numeric character reference: non character.',
  [ErrorCodes.NULL_CHARACTER_REFERENCE]:
    'Illegal numeric character reference: null character.',
  [ErrorCodes.SURROGATE_CHARACTER_REFERENCE]:
    'Illegal numeric character reference: non-pair surrogate.',
  [ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME]:
    'Attribute name cannot contain U+0022 ("), U+0027 (\'), and U+003C (<).',
  [ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE]:
    'Unquoted attribute value cannot contain U+0022 ("), U+0027 (\'), U+003C (<), U+003D (=), and U+0060 (`).',
  [ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME]:
    "Attribute name cannot start with '='.",
  [ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME]:
    "'<?' is allowed only in XML context.",
  [ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG]: "Illegal '/' in tags.",
  [ErrorCodes.UNKNOWN_NAMED_CHARACTER_REFERENCE]: 'Unknown entity name.',

  // Vue-specific parse errors
  [ErrorCodes.X_INVALID_END_TAG]: 'Invalid end tag.',
  [ErrorCodes.X_MISSING_END_TAG]: 'End tag was not found.',
  [ErrorCodes.X_MISSING_INTERPOLATION_END]:
    'Interpolation end sign was not found.',
  [ErrorCodes.X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END]:
    'End bracket for dynamic directive argument was not found. ' +
    'Note that dynamic directive argument cannot contain spaces.',

  // transform errors
  [ErrorCodes.X_IF_NO_EXPRESSION]: `v-if/v-else-if is missing expression.`,
  [ErrorCodes.X_ELSE_NO_ADJACENT_IF]: `v-else/v-else-if has no adjacent v-if.`,
  [ErrorCodes.X_FOR_NO_EXPRESSION]: `v-for is missing expression.`,
  [ErrorCodes.X_FOR_MALFORMED_EXPRESSION]: `v-for has invalid expression.`,
  [ErrorCodes.X_V_BIND_NO_EXPRESSION]: `v-bind is missing expression.`,
  [ErrorCodes.X_V_ON_NO_EXPRESSION]: `v-on is missing expression.`,
  [ErrorCodes.X_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET]: `Unexpected custom directive on <slot> outlet.`,
  [ErrorCodes.X_NAMED_SLOT_ON_COMPONENT]:
    `Named v-slot on component. ` +
    `Named slots should use <template v-slot> syntax nested inside the component.`,
  [ErrorCodes.X_MIXED_SLOT_USAGE]:
    `Mixed v-slot usage on both the component and nested <template>.` +
    `The default slot should also use <template> syntax when there are other ` +
    `named slots to avoid scope ambiguity.`,
  [ErrorCodes.X_DUPLICATE_SLOT_NAMES]: `Duplicate slot names found. `,
  [ErrorCodes.X_EXTRANEOUS_NON_SLOT_CHILDREN]:
    `Extraneous children found when component has explicit slots. ` +
    `These children will be ignored.`,
  [ErrorCodes.X_MISPLACED_V_SLOT]: `v-slot can only be used on components or <template> tags.`,

  // generic errors
  [ErrorCodes.X_PREFIX_ID_NOT_SUPPORTED]: `"prefixIdentifiers" option is not supported in this build of compiler.`,
  [ErrorCodes.X_MODULE_MODE_NOT_SUPPORTED]: `ES module mode is not supported in this build of compiler.`
}
