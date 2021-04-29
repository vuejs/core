export function triggerEvent(
  target: Element,
  event: string,
  process?: (e: any) => any
) {
  const e = document.createEvent('HTMLEvents')
  e.initEvent(event, true, true)
  if (process) process(e)
  target.dispatchEvent(e)
  return e
}
