import { makeMap } from './makeMap'

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
const GLOBAL_SIMPLE_VALUE = 'globalThis,Infinity,NaN,undefined'
const FUNCTION =
  'eval,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent'
const FUNDAMENTAL = 'Object,Function,Boolean,Symbol'
const ERROR =
  'Error,AggregateError,EvalError,RangeError,ReferenceError,SyntaxError,TypeError,URIError'
const NUMBER_AND_DATES = 'Math,BigInt,Number,Date'
const TEXT = 'String,RegExp'
const INDEXED_COLLECTIONS =
  'Array,Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,BigInt64Array,BigUint64Array,Float32Array,Float64Array'
const KEYED_COLLECTIONS = 'Map,Set,WeakMap,WeakSet'
const STRUCTURED_DATA = 'ArrayBuffer,SharedArrayBuffer,DataView,Atomics,JSON'
const MANAGING_MEMORY = 'WeakRef,FinalizationRegistry'
const CONTROL_ABSTRACTION_OBJECTS =
  'Iterator,AsyncIterator,Promise,GeneratorFunction,AsyncGeneratorFunction,Generator,AsyncGenerator,AsyncFunction'
const Reflection = 'Reflect,Proxy'
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
  MANAGING_MEMORY,
  CONTROL_ABSTRACTION_OBJECTS,
  Reflection,
  INTERNATIONALIZATION,
  OTHER_GLOBALS_ALLOWED
].join(',')

export const isGloballyAllowed = /*#__PURE__*/ makeMap(GLOBALS_ALLOWED)

/** @deprecated use `isGloballyAllowed` instead */
export const isGloballyWhitelisted = isGloballyAllowed
