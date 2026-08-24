import { createVaporSSRApp } from '../../src'
import { fixtures } from '../bench/hydration.fixtures'
import { setupHydrationTest } from './_helpers'

setupHydrationTest()

// The bench fixtures write their SSR markup by hand so the bench can run in a
// browser without @vue/compiler-sfc. A wrong shape would not fail the bench —
// it would quietly measure mismatch recovery instead of adoption. These guards
// keep the shapes honest.
describe('bench fixtures hydrate cleanly', () => {
  for (const fixture of fixtures) {
    test(fixture.name, () => {
      const container = document.createElement('div')
      container.innerHTML = fixture.html
      document.body.appendChild(container)

      const app = createVaporSSRApp(fixture.comp)
      app.mount(container)

      // adoption reproduces the server markup, with only client-inserted
      // anchors added
      expect(container.innerHTML.replace(/<!--[^>]*-->/g, '')).toBe(
        fixture.html.replace(/<!--[^>]*-->/g, ''),
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()
      app.unmount()
    })
  }
})
