export function patchTextContent(el: Element, value: string) {
  if (el) {
    el.textContent = value
  }
}

export function patchNodeValue(el: Text, value: string) {
  if (el) {
    el.nodeValue = value
  }
}
