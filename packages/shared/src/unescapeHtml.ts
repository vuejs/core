const unescapeHtmlRE = /&\w+;|&#(\d+);/g
const UNESCAPE_HTML = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
}
export function unescapeHtml(s: string | null) {
  if (!s) return s
  return s.replace(unescapeHtmlRE, function ($0: string, $1: number) {
    let c = UNESCAPE_HTML[$0 as keyof typeof UNESCAPE_HTML]
    if (c === undefined) {
      // Maybe is Entity Number
      if (!isNaN($1)) {
        c = String.fromCharCode($1 === 160 ? 32 : $1)
      } else {
        // Not Entity Number
        c = $0
      }
    }
    return c
  })
}
