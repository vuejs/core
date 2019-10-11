const modifierGuards: Record<string, (e: Event) => void | boolean> = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
  ctrl: e => !('ctrlKey' in e),
  shift: e => !('shiftKey' in e),
  alt: e => !('altKey' in e),
  meta: e => !('metaKey' in e),
  left: (e: MouseEvent) => 'button' in e && e.button !== 0,
  middle: (e: MouseEvent) => 'button' in e && e.button !== 1,
  right: (e: MouseEvent) => 'button' in e && e.button !== 2
}

// todo
// KeyboardEvent.keyCode aliases
const keyCodes: { [key: string]: number | Array<number> } = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  up: 38,
  left: 37,
  right: 39,
  down: 40,
  delete: [8, 46]
}

export const vOnModifiersGuard = (fn: Function, modifiers: string[]) => {
  return (event: Event) => {
    for (let modifier in modifiers) {
      let guard = modifierGuards[modifier]
      if (guard && guard(event)) return
    }
    return fn(event)
  }
}
