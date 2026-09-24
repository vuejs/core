import {
  type AdoptTarget,
  type HydrationCursor,
  adoptTemplate,
  advanceHydrationNode,
  currentHydrationNode,
  enterHydrationCursor,
  exitHydrationCursor,
  hydrateTextNode,
  isComment,
  isHydrating,
  parseAdoptTarget,
  resolveHydrationTarget,
  validateHydrationTarget,
} from './hydration'
import { insertionParent, resetInsertionState } from '../insertionState'
import {
  type Namespace,
  type NormalizedStyle,
  TemplateFlags,
  parseStringStyle,
} from '@vue/shared'
import { createTextNode, parseTemplate } from './node'
import { currentRenderContext } from '../renderContext'
import { cloneStampedTemplate } from './scopeIdStamp'

// the class and style a root's template contributes, shared by all its
// instances (see the incremental setters in prop.ts)
export type RootMeta = { cls?: string[]; sty?: NormalizedStyle }

function cloneTemplate(n: Node): Node {
  const scopeIds = currentRenderContext.slotScopeIds
  return scopeIds ? cloneStampedTemplate(n, scopeIds) : n.cloneNode(true)
}

/*@__NO_SIDE_EFFECTS__*/
export function template(html: string, flags: number = 0, ns?: Namespace) {
  const root = !!(flags & TemplateFlags.ROOT)
  const isStatic = !!(flags & TemplateFlags.STATIC)
  let node: Node
  // parsed once on first hydration adoption; every later instance of this
  // template compares against the cached form instead of re-scanning `html`
  let adoptTarget: AdoptTarget | undefined
  // from the parsed html: a hydrated node already carries the SSR fallthrough
  let rootMeta: RootMeta | undefined
  const resolveRootMeta = (): RootMeta => {
    const meta: RootMeta = {}
    if (html.includes(' class=') || html.includes(' style=')) {
      const el = (node ||= parseTemplate(html, ns)) as Element
      // the DOM tokenizes on ASCII whitespace only, unlike `\s`
      if (el.classList.length) meta.cls = Array.from(el.classList)
      const sty = el.getAttribute('style')
      if (sty) meta.sty = parseStringStyle(sty)
    }
    return meta
  }
  return (): Node & { $root?: RootMeta } => {
    // a template child of a createElement-backed element carries insertion
    // state: its server output sits inside that element, not in the cursor
    let hydrationCursor: HydrationCursor | null = null
    if (insertionParent) {
      if (isHydrating) {
        hydrationCursor = enterHydrationCursor(
          undefined,
          (adoptTarget ||= parseAdoptTarget(html)).blank,
        )
      } else resetInsertionState()
    }
    if (isHydrating) {
      let adopted: Node | null = null
      // static templates only need to skip fragment markers, teleport
      // markers, and hydration anchors before advancing the hydration
      // cursor, so they don't need to go through adoptTemplate. Vapor
      // never mutates their DOM afterwards.
      if (
        isStatic &&
        // SSR empty branches are empty comments. Let adoptTemplate() replace
        // them when the client selected this static branch.
        !isComment(currentHydrationNode!, '')
      ) {
        adopted = resolveHydrationTarget(currentHydrationNode!)
        if (html !== '') {
          if (html[0] !== '<') {
            // Static text normally matches, but patch the rare mismatch to
            // align with vdom text hydration.
            if (
              !hydrateTextNode(adopted, html) &&
              (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__)
            ) {
              validateHydrationTarget(adopted, html)
            }
          } else if (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) {
            validateHydrationTarget(adopted, html)
          }
        }
        // a hydrated node carries instance state (SSR fallthrough attrs, slot
        // scope ids), so post-hydration CSR clones come from the parsed html
        // unless that was stripped
        if (!node && !html) node = adopted.cloneNode(true)
        advanceHydrationNode(adopted)
      } else {
        // do not assign `adopted` to `node`, or CSR clones would duplicate children.
        adopted = adoptTemplate(
          currentHydrationNode!,
          html,
          false,
          ns,
          (adoptTarget ||= parseAdoptTarget(html)),
        )!
      }
      if (root) (adopted as any).$root = rootMeta ||= resolveRootMeta()
      exitHydrationCursor(hydrationCursor)
      return adopted
    }

    // fast path for text nodes
    if (!node && html[0] !== '<') {
      return createTextNode(html)
    }
    const ret = cloneTemplate((node ||= parseTemplate(html, ns)))
    if (root) (ret as any).$root = rootMeta ||= resolveRootMeta()
    return ret
  }
}
