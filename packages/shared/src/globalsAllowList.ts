import { makeMap } from './makeMap'

const GLOBALS_ALLOWED =
  'Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,' +
  'decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,' +
  'Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error'

export const isGloballyAllowed = /*#__PURE__*/ makeMap(GLOBALS_ALLOWED)

/** @deprecated use `isGloballyAllowed` instead */
export const isGloballyWhitelisted = isGloballyAllowed
