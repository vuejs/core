import { type Locator, locators } from 'vitest/browser'

locators.extend({
  getByCSS(css: string) {
    return `css=${css}`
  },
})

const div = document.createElement('div')
div.id = 'app'
document.body.appendChild(div)

declare module 'vitest/browser' {
  interface LocatorSelectors {
    getByCSS(css: string): Locator
  }
}
