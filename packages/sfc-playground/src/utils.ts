export function debounce(fn: Function, n = 100) {
  let handle: number | null = null
  return (...args: any[]) => {
    if (handle) window.clearTimeout(handle)
    handle = window.setTimeout(() => {
      fn(...args)
      handle = null
    }, n)
  }
}

// prefer old unicode hacks for backward compatibility
// https://base64.guru/developers/javascript/examples/unicode-strings
export function utoa(data: string): string {
  return btoa(unescape(encodeURIComponent(data)))
}

export function atou(base64: string): string {
  return decodeURIComponent(escape(atob(base64)))
}
