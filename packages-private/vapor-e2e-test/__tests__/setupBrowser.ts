import { locators } from '@vitest/browser/context'

locators.extend({
  getByCSS(css: string) {
    return `css=${css}`
  },
})

const div = document.createElement('div')
div.id = 'app'
document.body.appendChild(div)

declare module '@vitest/browser/context' {
  interface LocatorSelectors {
    getByCSS(css: string): Locator
  }
}
