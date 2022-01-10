let decoder: HTMLDivElement

export function decodeHtmlBrowser(raw: string, asAttr = false): string {
  if (!decoder) {
    decoder = document.createElement('div') // eslint-disable-line no-restricted-globals
  }
  if (asAttr) {
    decoder.innerHTML = `<div foo="${raw.replace(/"/g, '&quot;')}">`
    return decoder.children[0].getAttribute('foo') as string
  } else {
    decoder.innerHTML = raw
    return decoder.textContent as string
  }
}
