export const EMPTY_OBJ: { readonly [key: string]: any } = Object.freeze({})

export const isReservedProp = (key: string): boolean => {
  switch (key) {
    case 'key':
    case 'ref':
    case 'slots':
      return true
    default:
      return key.startsWith('nativeOn')
  }
}
