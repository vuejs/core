// Based on https://github.com/WebReflection/html-parsed-element/blob/11081fc102e2eec745a1a1d32723eef342df2452/esm/index.js
/*! (c) Andrea Giammarchi - ISC */

const HTMLParsedElement = (() => {
  if (typeof window === 'undefined') return class {}

  const DCL = 'DOMContentLoaded'
  const init = new WeakMap()
  // @ts-ignore
  const queue = []
  const isParsed = (el: Element) => {
    do {
      if (el.nextSibling) return true
      // @ts-ignore
    } while ((el = el.parentNode))
    return false
  }
  const upgrade = () => {
    // @ts-ignore
    queue.splice(0).forEach(info => {
      if (init.get(info[0]) !== true) {
        init.set(info[0], true)
        info[0][info[1]]()
      }
    })
  }
  window.document.addEventListener(DCL, upgrade)
  class HTMLParsedElement extends HTMLElement {
    static withParsedCallback(
      Class: CustomElementConstructor,
      name = 'parsed'
    ) {
      const { prototype } = Class
      const { connectedCallback } = prototype
      const method = name + 'Callback'
      const cleanUp = (
        el: Element,
        observer: MutationObserver,
        ownerDocument: Document,
        onDCL: EventListener
      ) => {
        observer.disconnect()
        ownerDocument.removeEventListener(DCL, onDCL)
        parsedCallback(el)
      }
      const parsedCallback = (el: Element) => {
        if (!queue.length) requestAnimationFrame(upgrade)
        queue.push([el, method])
      }
      Object.defineProperties(prototype, {
        connectedCallback: {
          configurable: true,
          writable: true,
          value() {
            if (connectedCallback) connectedCallback.apply(this, arguments)
            if (method in this && !init.has(this)) {
              const self = this
              const { ownerDocument } = self
              init.set(self, false)
              if (ownerDocument.readyState === 'complete' || isParsed(self))
                parsedCallback(self)
              else {
                const onDCL = () =>
                  cleanUp(self, observer, ownerDocument, onDCL)
                ownerDocument.addEventListener(DCL, onDCL)
                const observer = new MutationObserver(() => {
                  /* istanbul ignore else */
                  if (isParsed(self))
                    cleanUp(self, observer, ownerDocument, onDCL)
                })
                observer.observe(self.parentNode, {
                  childList: true,
                  subtree: true
                })
              }
            }
          }
        },
        [name]: {
          configurable: true,
          get() {
            return init.get(this) === true
          }
        }
      })
      return Class
    }
  }
  return HTMLParsedElement.withParsedCallback(HTMLParsedElement)
})()
export default HTMLParsedElement
