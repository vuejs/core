import { isArray } from '@vue/shared'

const modifierGuards: Record<string, (e: Event) => void | boolean> = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
  ctrl: e => !(e as any).ctrlKey,
  shift: e => !(e as any).shiftKey,
  alt: e => !(e as any).altKey,
  meta: e => !(e as any).metaKey,
  left: e => 'button' in e && (e as any).button !== 0,
  middle: e => 'button' in e && (e as any).button !== 1,
  right: e => 'button' in e && (e as any).button !== 2
}

const keyNames: Record<string, string | string[]> = {
  esc: 'escape',
  // IE11 uses `Spacebar` for Space key name.
  space: [' ', 'spacebar'],
  up: 'arrowup',
  left: 'arrowleft',
  right: 'arrowright',
  down: 'arrowdown',
  // IE11 uses `Del` for Delete key name.
  delete: ['backspace', 'del']
}

const modifierKeys = ['ctrl', 'shift', 'alt', 'meta']

export const vOnModifiersGuard = (fn: Function, modifiers: string[]) => {
  return (event: Event) => {
    for (let modifier of modifiers) {
      if (
        modifier === 'exact' &&
        // Some of the modifierKeys are not specified as modifier, but is flagged true on the event
        modifierKeys.some(
          modifierKey =>
            modifiers.indexOf(modifierKey) === -1 &&
            (event as any)[`${modifierKey}Key`]
        )
      ) {
        return
      }
      const guard = modifierGuards[modifier]
      if (guard && guard(event)) return
    }
    if ('key' in event) {
      const eventKey = (event['key'] as string).toLowerCase()
      const keysToMatch = modifiers.filter(m => !modifierGuards[m])
      if (
        // None of the provided key modifiers match the current event key
        !keysToMatch.some(
          k =>
            k === eventKey ||
            (isArray(keyNames[k])
              ? keyNames[k].includes(eventKey)
              : eventKey === keyNames[k])
        )
      ) {
        return
      }
    }
    return fn(event)
  }
}
