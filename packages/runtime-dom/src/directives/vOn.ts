const modifierGuards: Record<string, (e: Event) => void | boolean> = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
  ctrl: e => e instanceof KeyboardEvent && !e.ctrlKey,
  shift: e => e instanceof KeyboardEvent && !e.shiftKey,
  alt: e => e instanceof KeyboardEvent && !e.altKey,
  meta: e => e instanceof KeyboardEvent && !e.metaKey,
  left: e => e instanceof MouseEvent && 'button' in e && e.button !== 0,
  middle: e => e instanceof MouseEvent && 'button' in e && e.button !== 1,
  right: e => e instanceof MouseEvent && 'button' in e && e.button !== 2
}

const keyNames: Record<string, string | string[]> = {
  esc: 'Escape',
  // IE11 uses `Spacebar` for Space key name.
  space: [' ', 'Spacebar'],
  up: 'ArrowUp',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  down: 'ArrowDown',
  // IE11 uses `Del` for Delete key name.
  delete: ['Backspace', 'Del']
}

const modifierKeys = ['ctrl', 'shift', 'alt', 'meta']
// Currently there's no way to let ts know 'ctrl' + 'Key' is 'ctrlKey'
// https://github.com/microsoft/TypeScript/issues/12754
type ModifierKeysProperty = 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'

export const vOnModifiersGuard = (fn: Function, modifiers: string[]) => {
  return (event: Event) => {
    for (let modifier in modifiers) {
      if (
        modifier === 'exact' &&
        event instanceof KeyboardEvent &&
        // Some of the modifierKeys are not specified as modifier, but is flagged true on the event
        modifierKeys.some(modifierKey => {
          modifiers.indexOf(modifierKey) === -1 &&
            event[`${modifierKey}Key` as ModifierKeysProperty]
        })
      ) {
        return
      }
      const guard = modifierGuards[modifier]
      if (guard && guard(event)) return
    }
    if (event instanceof KeyboardEvent && 'key' in event) {
      const eventKey = event.key.toLowerCase()
      const keysToMatch = modifiers.filter(m => !modifierGuards[m])
      if (
        // None of the provided key modifiers match the current event key
        !keysToMatch.some(
          k =>
            k === eventKey ||
            (Array.isArray(keyNames[k])
              ? keyNames[k].indexOf(eventKey) > -1
              : eventKey === keyNames[k])
        )
      ) {
        return
      }
    }
    return fn(event)
  }
}
