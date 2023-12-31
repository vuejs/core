export function triggerEvent(
  target: Element,
  event: string,
  process?: (e: any) => any,
) {
  const e = new Event(event, {
    bubbles: true,
    cancelable: true,
  })
  if (process) process(e)
  target.dispatchEvent(e)
  return e
}
