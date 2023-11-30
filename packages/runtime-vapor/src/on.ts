export function on(
  el: any,
  event: string,
  handler: () => any,
  options?: EventListenerOptions,
) {
  el.addEventListener(event, handler, options)
}
