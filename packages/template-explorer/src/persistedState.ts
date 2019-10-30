import { CompilerOptions } from '@vue/compiler-dom'

interface persistedStateData {
  src: string
  options: CompilerOptions
}

export default {
  set({ src, options }: persistedStateData) {
    const state = JSON.stringify({
      src,
      options
    })
    localStorage.setItem('state', state)
    window.location.hash = encodeURIComponent(state)
  },
  get() {
    return JSON.parse(
      decodeURIComponent(window.location.hash.slice(1)) ||
        localStorage.getItem('state') ||
        `{}`
    )
  }
}
