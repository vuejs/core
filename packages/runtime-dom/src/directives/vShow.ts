import type { ObjectDirective } from '@vue/runtime-core'

export const vShowOldKey = Symbol('_vod')

interface VShowElement extends HTMLElement {
  // _vod = vue original display
  [vShowOldKey]: string
}

export const vShow: ObjectDirective<VShowElement> = {
  beforeMount(el, { value }, { transition }) {
    el[vShowOldKey] = el.style.display === 'none' ? '' : el.style.display
    if (transition && value) {
      transition.beforeEnter(el)
    } else {
      setDisplay(el, value)
    }
  },
  mounted(el, { value }, { transition }) {
    if (transition && value) {
      transition.enter(el)
    }
  },
  updated(el, { value, oldValue }, { transition }) {
    if (!value === !oldValue) return
    if (transition) {
      if (value) {
        transition.beforeEnter(el)
        setDisplay(el, true)
        transition.enter(el)
      } else {
        transition.leave(el, () => {
          setDisplay(el, false)
        })
      }
    } else {
      setDisplay(el, value)
    }
  },
  beforeUnmount(el, { value }) {
    setDisplay(el, value)
  },
}

function setDisplay(el: VShowElement, value: unknown): void {
  el.style.display = value ? el[vShowOldKey] : 'none'
}

// SSR vnode transforms, only used when user includes client-oriented render
// function in SSR
export function initVShowForSSR() {
  vShow.getSSRProps = ({ value }) => {
    if (!value) {
      return { style: { display: 'none' } }
    }
  }
}
