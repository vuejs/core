import { makeMap } from './makeMap'

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
const GLOBALS_ALLOWED =
  // Simple Global Values
  'Infinity,NaN,undefined,' +
  // Error types
  'Error,AggregateError,EvalError,RangeError,ReferenceError,SyntaxError,TypeError,URIError,' +
  // Fundamental functions
  'isFinite,isNaN,parseFloat,parseInt,decodeURI,' +
  'decodeURIComponent,encodeURI,encodeURIComponent,' +
  // Fundamental objects
  'Object,Boolean,Symbol,' +
  // Numbers and dates
  'Math,Number,Date,BigInt,' +
  // Text processing
  'String,RegExp,' +
  // Indexed collections
  'Array,' +
  // Keyed collections
  'Map,Set,' +
  // Structured data
  'JSON,' +
  // Internationalization & Localization
  'Intl,' +
  // Other globals
  'console'

export const isGloballyAllowed = /*#__PURE__*/ makeMap(GLOBALS_ALLOWED)

/** @deprecated use `isGloballyAllowed` instead */
export const isGloballyWhitelisted = isGloballyAllowed
