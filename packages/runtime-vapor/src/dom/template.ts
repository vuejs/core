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
import { type Namespace, Namespaces, TemplateFlags } from '@vue/shared'
import { _child, createTextNode } from './node'
import { currentRenderContext } from '../renderContext'
import { cloneStampedTemplate } from './scopeIdStamp'

let t: HTMLTemplateElement

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
  return (): Node & { $root?: true } => {
    // a template child of a createElement-backed element carries insertion
    // state of its own, because its server output sits inside that element
    // instead of the enclosing template
    let hydrationCursor: HydrationCursor | null = null
    if (insertionParent) {
      if (isHydrating) hydrationCursor = enterHydrationCursor()
      else resetInsertionState()
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
        // cache once for post-hydration CSR clones.
        if (!node) node = adopted.cloneNode(true)
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
      if (root) (adopted as any).$root = true
      exitHydrationCursor(hydrationCursor)
      return adopted
    }

    if (node) {
      const ret = cloneTemplate(node)
      if (root) (ret as any).$root = true
      return ret
    }

    // fast path for text nodes
    if (html[0] !== '<') {
      return createTextNode(html)
    }
    t = t || document.createElement('template')
    if (ns) {
      const tag = ns === Namespaces.SVG ? 'svg' : 'math'
      t.innerHTML = `<${tag}>${html}</${tag}>`
      node = _child(_child(t.content) as ParentNode)
    } else {
      t.innerHTML = html
      node = _child(t.content)
    }
    const ret = cloneTemplate(node)
    if (root) (ret as any).$root = true
    return ret
  }
}
