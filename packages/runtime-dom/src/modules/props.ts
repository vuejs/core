export function patchDOMProp(
  el: any,
  key: string,
  value: any,
  prevChildren: any,
  unmountChildren: any
) {
  if ((key === 'innerHTML' || key === 'textContent') && prevChildren != null) {
    unmountChildren(prevChildren)
  }
  el[key] = value
}
