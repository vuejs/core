import { compile as compileVapor } from '@vue/compiler-vapor'
import { BindingTypes } from '@vue/compiler-dom'
import * as runtimeDom from '@vue/runtime-dom'
import * as runtimeVapor from '../../src'
import { defineVaporComponent } from '../../src'

/**
 * Shared fixtures for `hydration.bench.ts`.
 *
 * The markup strings reproduce real SSR output shapes (captured from the
 * `compile(..., { ssr: true })` + `renderToString` pipeline the hydration specs
 * use). They are written out rather than produced by the SSR compiler so the
 * bench can run in a browser, where `@vue/compiler-sfc` is unavailable.
 *
 * Because a wrong shape would silently send the bench through mismatch
 * recovery instead of the adoption path it means to measure,
 * `__tests__/hydration/benchFixtures.spec.ts` asserts every fixture hydrates
 * with no mismatch and reproduces its own markup.
 */

export const N = 250

function compileToRender(
  template: string,
  bindingMetadata?: Record<string, BindingTypes>,
): any {
  const { code } = compileVapor(template, {
    mode: 'module',
    prefixIdentifiers: true,
    bindingMetadata,
  })
  const transformed = code
    .replace(/\bimport {/g, 'const {')
    .replace(/ as _/g, ': _')
    .replace(/} from ['"]vue['"];?/g, '} = Vue;')
    .replace(/export function render/, 'function render')
  return new Function('Vue', `${transformed}\nreturn render`)({
    ...runtimeDom,
    ...runtimeVapor,
  })
}

function component(
  template: string,
  setupState: Record<string, any> = {},
): any {
  const bindingMetadata: Record<string, BindingTypes> = {}
  for (const key in setupState) {
    bindingMetadata[key] = BindingTypes.SETUP_CONST
  }
  return defineVaporComponent({
    render: compileToRender(template, bindingMetadata),
    setup: () => setupState,
  })
}

export interface HydrationFixture {
  name: string
  comp: any
  html: string
}

const items = Array.from({ length: N }, (_, i) => `item ${i}`)
const flags = Array.from({ length: N }, (_, i) => i % 2 === 0)
const range = (fn: (i: number) => string) =>
  Array.from({ length: N }, (_, i) => fn(i)).join('')

const staticMarkup = `<div class="wrap">${range(
  i => `<section class="row"><h3>heading ${i}</h3><p>body ${i}</p></section>`,
)}</div>`

const Row = component(`<li class="row"><slot/></li>`)
const Card = component(`<div class="card"><slot><em>fallback</em></slot></div>`)

export const fixtures: HydrationFixture[] = [
  // Static markup: the ceiling for the STATIC template fast path, which skips
  // adoptTemplate and only walks the cursor.
  {
    name: 'static',
    comp: component(staticMarkup),
    html: staticMarkup,
  },
  // One logical unit per item, no per-item fragment.
  {
    name: 'v-for single-root',
    comp: component(
      `<ul><li v-for="item in items" :key="item">{{ item }}</li></ul>`,
      { items },
    ),
    html: `<ul><!--[-->${range(i => `<li>item ${i}</li>`)}<!--]--></ul>`,
  },
  // Multi-root items wrap each item in <!--[-->...<!--]-->: every item costs a
  // fragment range (locateEndAnchor + $fe caching + an anchor claim).
  {
    name: 'v-for multi-root',
    comp: component(
      `<ul><template v-for="item in items" :key="item"><li>{{ item }}</li><li>{{ item }}-b</li></template></ul>`,
      { items },
    ),
    html: `<ul><!--[-->${range(
      i => `<!--[--><li>item ${i}</li><li>item ${i}-b</li><!--]-->`,
    )}<!--]--></ul>`,
  },
  // Dense dynamic blocks under one parent: every v-if claims an anchor, so this
  // is where synchronously inserted untracked anchors accumulate and
  // `skipUntrackedAnchors` has real work during the rest of the walk.
  {
    name: 'dense dynamic anchors',
    comp: component(
      `<div>${range(
        i => `<span v-if="flags[${i}]">on ${i}</span><b>static ${i}</b>`,
      )}</div>`,
      { flags },
    ),
    html: `<div>${range(i =>
      flags[i]
        ? `<span>on ${i}</span><b>static ${i}</b>`
        : `<!----><b>static ${i}</b>`,
    )}</div>`,
  },
  // A component boundary per row: enterHydrationCursor/exitHydrationCursor plus
  // slot content per row.
  {
    name: 'component items',
    comp: component(
      `<ul><Row v-for="item in items" :key="item">{{ item }}</Row></ul>`,
      { items, Row },
    ),
    html: `<ul><!--[-->${range(
      i => `<li class="row"><!--[-->item ${i}<!--]--></li>`,
    )}<!--]--></ul>`,
  },
  // Slot outlets with fallback keep the pending content-vs-fallback machinery
  // live for every outlet.
  {
    name: 'slots with fallback',
    comp: component(
      `<div><Card v-for="item in items" :key="item"><span>{{ item }}</span></Card></div>`,
      { items, Card },
    ),
    html: `<div><!--[-->${range(
      i => `<div class="card"><!--[--><span>item ${i}</span><!--]--></div>`,
    )}<!--]--></div>`,
  },
]
