// todo
export const vOnModifiersGuard = (fn: Function, modifiers: string[]) => {
  return (event: Event) => {
    return fn(event)
  }
}
