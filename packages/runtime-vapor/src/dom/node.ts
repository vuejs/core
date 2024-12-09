import { isArray } from '@vue/shared'
import { renderEffect } from '../renderEffect'
import { setText } from './prop'

export function createTextNode(values?: any[] | (() => any[])): Text {
  // eslint-disable-next-line no-restricted-globals
  const node = document.createTextNode('')
  if (values) {
    if (isArray(values)) {
      setText(node, ...values)
    } else {
      renderEffect(() => setText(node, ...values()))
    }
  }
  return node
}

/*! #__NO_SIDE_EFFECTS__ */
export function createComment(data: string): Comment {
  // eslint-disable-next-line no-restricted-globals
  return document.createComment(data)
}

/*! #__NO_SIDE_EFFECTS__ */
export function querySelector(selectors: string): Element | null {
  // eslint-disable-next-line no-restricted-globals
  return document.querySelector(selectors)
}
