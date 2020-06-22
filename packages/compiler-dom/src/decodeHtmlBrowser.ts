/* eslint-disable no-restricted-globals */

let decoder: HTMLDivElement

export function decodeHtmlBrowser(raw: string): string {
  ;(decoder || (decoder = document.createElement('div'))).innerHTML = raw
  return decoder.textContent as string
}
