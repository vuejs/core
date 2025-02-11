/*! #__NO_SIDE_EFFECTS__ */
export function createTextNode(value = ''): Text {
  return document.createTextNode(value)
}

/*! #__NO_SIDE_EFFECTS__ */
export function createComment(data: string): Comment {
  return document.createComment(data)
}

/*! #__NO_SIDE_EFFECTS__ */
export function querySelector(selectors: string): Element | null {
  return document.querySelector(selectors)
}
