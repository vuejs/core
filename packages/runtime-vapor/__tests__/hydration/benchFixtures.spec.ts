import { createVaporSSRApp } from '../../src'
import { VueServerRenderer, compile, runtimeDom, stripAnchors } from '../_utils'
import { fixtures, sources } from '../bench/hydration.fixtures'
import { setupHydrationTest } from './_helpers'

setupHydrationTest()

// The server-side twin of a fixture component: the same template and setup
// state compiled for SSR, with the components in the state swapped for their
// own twins.
function ssrTwin(comp: any): any {
  const { template, setupState } = sources.get(comp)!
  const state: Record<string, any> = {}
  for (const key in setupState) {
    const value = setupState[key]
    state[key] = sources.has(value) ? ssrTwin(value) : value
  }
  return compile(
    `<script vapor>const { ${Object.keys(state).join(', ')} } = _data</script>` +
      `<template>${template}</template>`,
    state as any,
    {},
    { ssr: true },
  )
}

// The bench fixtures write their SSR markup by hand so the bench can run in a
// browser without @vue/compiler-sfc. A wrong shape would not fail the bench —
// it would quietly measure mismatch recovery instead of adoption. These guards
// keep the shapes honest.
describe('bench fixtures hydrate cleanly', () => {
  for (const fixture of fixtures) {
    test(fixture.name, async () => {
      expect(fixture.html).toBe(
        await VueServerRenderer.renderToString(
          runtimeDom.createSSRApp(ssrTwin(fixture.comp)),
        ),
      )

      const container = document.createElement('div')
      container.innerHTML = fixture.html
      document.body.appendChild(container)

      const app = createVaporSSRApp(fixture.comp)
      app.mount(container)

      // adoption reproduces the server markup, with only client-inserted
      // anchors added
      expect(stripAnchors(container.innerHTML)).toBe(stripAnchors(fixture.html))
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()
      app.unmount()
    })
  }
})
