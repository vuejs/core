export const enum ParserErrorTypes {
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
  X_INVALID_END_TAG,
  X_MISSING_END_TAG,
  X_MISSING_INTERPOLATION_END,
  X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END
}

export const errorMessages: { [code: number]: string } = {
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
