const escapeRE = /["'&<>]/

export function escapeHtml(string: unknown) {
  const str = '' + string
  const match = escapeRE.exec(str)

  if (!match) {
    return str
  }

  let html = ''
  let escaped: string
  let index: number
  let lastIndex = 0
  const codeToEscapes:any = {
    34:'&quot;', // "
    38:'&amp;', // &
    39:'&#39;', // '
    60:'&lt;', // <
    62:'&gt;'  // >
  }
  for (index = match.index; index < str.length; index++) {
    const code = str.charCodeAt(index)
    if(codeToEscapes[code]){
      escaped = codeToEscapes[code]
      if (lastIndex !== index) {
        html += str.substring(lastIndex, index)
      }
      lastIndex = index + 1
      html += escaped
    }
  }
  return lastIndex !== index ? html + str.substring(lastIndex, index) : html
}

// https://www.w3.org/TR/html52/syntax.html#comments
const commentStripRE = /^-?>|<!--|-->|--!>|<!-$/g

export function escapeHtmlComment(src: string): string {
  return src.replace(commentStripRE, '')
}
