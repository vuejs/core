/**
 * Used during vnode props/slots normalization to check if the vnode props/slots
 * are the internal attrs / slots object of a component via
 * `Object.getPrototypeOf`. This is more performant than defining a
 * non-enumerable property. (one of the optimizations done for ssr-benchmark)
 */
const internalObjectProto = {}

export const createInternalObject = () => Object.create(internalObjectProto)

export const isInternalObject = (obj: object) =>
  Object.getPrototypeOf(obj) === internalObjectProto
