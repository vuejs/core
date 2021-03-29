/* eslint-disable no-restricted-globals */

const encodeRE = /<|>/g
const encodeMap: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;'
}

let decoder: HTMLDivElement

export function decodeHtmlBrowser(raw: string): string {
  ;(
    decoder || (decoder = document.createElement('div'))
  ).innerHTML = raw.replace(encodeRE, (_, p1) => encodeMap[p1])
  return decoder.textContent as string
}
