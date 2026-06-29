import {
  adoptTemplate,
  advanceHydrationNode,
  currentHydrationNode,
  hydrateTextNode,
  isComment,
  isHydrating,
  resolveHydrationTarget,
  validateHydrationTarget,
} from './hydration'
import { type Namespace, Namespaces, TemplateFlags } from '@vue/shared'
import { _child, createTextNode } from './node'
import { resolvePendingSlotContent } from './hydrateFragment'

let t: HTMLTemplateElement

/*@__NO_SIDE_EFFECTS__*/
export function template(html: string, flags: number = 0, ns?: Namespace) {
  const root = !!(flags & TemplateFlags.ROOT)
  const isStatic = !!(flags & TemplateFlags.STATIC)
  let node: Node
  return (): Node & { $root?: true } => {
    if (isHydrating) {
      // Comment templates may be empty branch anchors. Only real DOM/text
      // templates prove that slot content is valid.
      if (!(html[0] === '<' && html[1] === '!')) {
        resolvePendingSlotContent()
      }
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
        adopted = adoptTemplate(currentHydrationNode!, html, false, ns)!
      }
      if (root) (adopted as any).$root = true
      return adopted
    }

    if (node) {
      const ret = node.cloneNode(true)
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
    const ret = node.cloneNode(true)
    if (root) (ret as any).$root = true
    return ret
  }
}
