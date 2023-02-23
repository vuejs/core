const decodeHtmlRE = /&\w+;|&#(\d+);/g
const DECODE_HTML = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'"
}
export function decodeHtml(s: string | null) {
  if (!s) return s
  return s.replace(decodeHtmlRE, function ($0: string, $1: number) {
    let c = DECODE_HTML[$0 as keyof typeof DECODE_HTML]
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
