import { isString } from '@vue/shared'
import { DOMNodeTypes, isComment } from './hydration'

export type HydrationStrategy = (hydrate: () => void, el: Node) => void

export type HydrationStrategyFactory<Options = any> = (
  options?: Options,
) => HydrationStrategy

export const hydrateOnIdle: HydrationStrategyFactory = () => hydrate => {
  requestIdleCallback(hydrate)
}

export const hydrateOnVisible: HydrationStrategyFactory<string | number> =
  (margin = 0) =>
  (hydrate, node) => {
    const ob = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          ob.disconnect()
          hydrate()
          break
        }
      },
      {
        rootMargin: isString(margin) ? margin : margin + 'px',
      },
    )
    forEachNode(node, el => ob.observe(el))
  }

export const hydrateOnMediaQuery: HydrationStrategyFactory<string> =
  query => hydrate => {
    if (query) {
      const mql = matchMedia(query)
      if (mql.matches) {
        hydrate()
      } else {
        mql.addEventListener('change', hydrate, { once: true })
      }
    }
  }

export const hydrateOnInteraction: HydrationStrategyFactory<
  string | string[]
> =
  (interactions = []) =>
  (hydrate, node) => {
    if (isString(interactions)) interactions = [interactions]
    let hasHydrated = false
    const doHydrate = (e: Event) => {
      if (!hasHydrated) {
        hasHydrated = true
        forEachNode(node, el => {
          for (const i of interactions) {
            el.removeEventListener(i, doHydrate)
          }
        })
        hydrate()
        // replay event
        e.target!.dispatchEvent(new (e.constructor as any)(e.type, e))
      }
    }
    forEachNode(node, el => {
      for (const i of interactions) {
        el.addEventListener(i, doHydrate, { once: true })
      }
    })
  }

function forEachNode(node: Node, cb: (el: Element) => void) {
  // fragment
  if (isComment(node) && node.data === '[') {
    let next = node.nextSibling
    while (next && next.nodeType === DOMNodeTypes.ELEMENT) {
      cb(next as Element)
      next = next.nextSibling
    }
  } else {
    cb(node as Element)
  }
}
