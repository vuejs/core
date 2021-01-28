const escapeRE = /["'&<>]/

export function escapeHtml(unsafeStr: string): string {
  return unsafeStr.replace(escapeRE, char => {
    switch (char) {
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      default:
        return char
    }
  })
}

// https://www.w3.org/TR/html52/syntax.html#comments
const commentStripRE = /^-?>|<!--|-->|--!>|<!-$/g

export function escapeHtmlComment(src: string): string {
  return src.replace(commentStripRE, '')
}
