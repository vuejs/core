import { makeMap } from './makeMap'

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
const GLOBAL_SIMPLE_VALUE = 'Infinity,NaN,undefined'

const ERROR =
  'Error,AggregateError,EvalError,RangeError,ReferenceError,SyntaxError,TypeError,URIError'

const FUNCTION =
  'isFinite,isNaN,parseFloat,parseInt,decodeURI,' +
  'decodeURIComponent,encodeURI,encodeURIComponent'

const FUNDAMENTAL = 'Object,Boolean,Symbol'

const NUMBER_AND_DATES = 'Math,Number,Date,BigInt'

const TEXT = 'String,RegExp'

const INDEXED_COLLECTIONS = 'Array'

const KEYED_COLLECTIONS = 'Map,Set'

const STRUCTURED_DATA = 'JSON'

const INTERNATIONALIZATION = 'Intl'

const OTHER_GLOBALS_ALLOWED = 'console'

const GLOBALS_ALLOWED = [
  GLOBAL_SIMPLE_VALUE,
  FUNCTION,
  FUNDAMENTAL,
  ERROR,
  NUMBER_AND_DATES,
  TEXT,
  INDEXED_COLLECTIONS,
  KEYED_COLLECTIONS,
  STRUCTURED_DATA,
  INTERNATIONALIZATION,
  OTHER_GLOBALS_ALLOWED
].join(',')

export const isGloballyAllowed = /*#__PURE__*/ makeMap(GLOBALS_ALLOWED)

/** @deprecated use `isGloballyAllowed` instead */
export const isGloballyWhitelisted = isGloballyAllowed
