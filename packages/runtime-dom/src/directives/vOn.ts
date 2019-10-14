import { isArray } from '@vue/shared'

const systemModifiers = new Set(['ctrl', 'shift', 'alt', 'meta'])

const modifierGuards: Record<
  string,
  (e: Event, modifiers?: string[]) => void | boolean
> = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
  ctrl: e => !(e as any).ctrlKey,
  shift: e => !(e as any).shiftKey,
  alt: e => !(e as any).altKey,
  meta: e => !(e as any).metaKey,
  left: e => 'button' in e && (e as any).button !== 0,
  middle: e => 'button' in e && (e as any).button !== 1,
  right: e => 'button' in e && (e as any).button !== 2,
  exact: (e, modifiers) =>
    modifiers.some(m => systemModifiers.has(m) && (e as any)[`${m}Key`])
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

export const vOnModifiersGuard = (fn: Function, modifiers: string[]) => {
  return (event: Event) => {
    for (let i = 0; i < modifiers.length; i++) {
      const guard = modifierGuards[modifiers[i]]
      if (guard && guard(event, modifiers)) return
    }
    return fn(event)
  }
}

export const vOnKeysGuard = (fn: Function, modifiers: string[]) => {
  return (event: KeyboardEvent) => {
    if (!('key' in event)) return
    const eventKey = event.key.toLowerCase()
    if (
      // None of the provided key modifiers match the current event key
      !modifiers.some(
        k =>
          k === eventKey ||
          (isArray(keyNames[k])
            ? keyNames[k].includes(eventKey)
            : eventKey === keyNames[k])
      )
    ) {
      return
    }
    return fn(event)
  }
}
