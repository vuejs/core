export function patchDOMProp(
  el: any,
  key: string,
  value: any,
  // the next 3 args are passed only due to potential innerHTML/textContent
  // overriding existing VNodes, in which case the old tree must be properly
  // unmounted.
  prevChildren: any,
  parentComponent: any,
  unmountChildren: any
) {
  if ((key === 'innerHTML' || key === 'textContent') && prevChildren != null) {
    unmountChildren(prevChildren, parentComponent)
  }
  el[key] = value == null ? '' : value
}
