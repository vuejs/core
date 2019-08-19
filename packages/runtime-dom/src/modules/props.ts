export function patchDOMProp(
  el: any,
  key: string,
  value: any,
  prevChildren: any,
  parentComponent: any,
  unmountChildren: any
) {
  if ((key === 'innerHTML' || key === 'textContent') && prevChildren != null) {
    unmountChildren(prevChildren, parentComponent)
  }
  el[key] = value
}
