import { bench, describe } from 'vitest'
import { createVaporSSRApp } from '../../src'
import { type HydrationFixture, fixtures } from './hydration.fixtures'

/**
 * Hydration benchmarks.
 *
 * Hydration consumes its server markup, so every iteration needs a fresh copy.
 * Re-parsing HTML per iteration would dominate the measurement, so each
 * scenario parses once into a prototype container and clones it per iteration.
 * Every scenario ships a `clone only` control measuring that clone + attach +
 * detach with no hydration — subtract it for the hydration cost itself.
 *
 * Fixtures (and the guarantee that they hydrate cleanly rather than falling
 * into mismatch recovery) live in `hydration.fixtures.ts`.
 *
 * Run prod-like (mismatch checks and dev anchor labels compiled out) with:
 *   MODE=benchmark npx vp test bench --project=bench-browser --run
 *
 * Each iteration builds and tears down a whole app, so the tail is GC-bound;
 * at vitest's default 500ms two runs of identical code differed by up to 18%.
 * The longer sampling window below brings run-to-run variance to a few percent,
 * which is what makes A/B comparisons of traversal-level changes meaningful.
 * Compare `mean`, and treat anything under ~5% as noise.
 */

const OPTIONS = { time: 2000, warmupTime: 500 }

function prototype(f: HydrationFixture): HTMLElement {
  const proto = document.createElement('div')
  proto.innerHTML = f.html
  return proto
}

for (const fixture of fixtures) {
  const proto = prototype(fixture)

  const prepare = (): HTMLElement => {
    const container = proto.cloneNode(true) as HTMLElement
    document.body.appendChild(container)
    return container
  }

  describe(fixture.name, () => {
    bench(
      'hydrate',
      () => {
        const container = prepare()
        const app = createVaporSSRApp(fixture.comp)
        app.mount(container)
        app.unmount()
        container.remove()
      },
      OPTIONS,
    )

    bench('clone only', () => prepare().remove(), OPTIONS)
  })
}
