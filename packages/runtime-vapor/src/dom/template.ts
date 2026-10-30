import {
  type AdoptTarget,
  type HydrationCursor,
  adoptTemplate,
  advanceHydrationNode,
  currentHydrationNode,
  enterHydrationCursor,
  exitHydrationCursor,
  isClaimedAnchor,
  isHydrating,
  parseAdoptTarget,
  resolveHydrationTarget,
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
export type RootMeta = {
  readonly cls?: string[]
  readonly sty?: NormalizedStyle
}

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
  // parsed from the html on first use, never from a hydrated node (it
  // already carries the SSR fallthrough values); most roots never need it
  let rootMeta: RootMeta | undefined
  const createRootMeta = (): RootMeta => {
    let cls: string[] | undefined
    let sty: NormalizedStyle | undefined
    let resolved = false
    const resolve = () => {
      resolved = true
      if (html.includes(' class=') || html.includes(' style=')) {
        const el = (node ||= parseTemplate(html, ns)) as Element
        // the DOM tokenizes on ASCII whitespace only, unlike `\s`
        if (el.classList.length) cls = Array.from(el.classList)
        const style = el.getAttribute('style')
        if (style) sty = parseStringStyle(style)
      }
    }
    return {
      get cls() {
        resolved || resolve()
        return cls
      },
      get sty() {
        resolved || resolve()
        return sty
      },
    }
  }
  return (): Node & { $root?: RootMeta } => {
    // a template child of a createElement-backed element carries insertion
    // state: its server output sits inside that element, not in the cursor
    let hydrationCursor: HydrationCursor | null = null
    if (insertionParent) {
      if (isHydrating) {
        hydrationCursor = enterHydrationCursor(
          undefined,
          (adoptTarget ||= parseAdoptTarget(html, isStatic)).blank,
        )
      } else resetInsertionState()
    }
    if (isHydrating) {
      let adopted: Node
      // A static template stripped of its content at build time has nothing
      // to compare against: the node is adopted as it stands, as vdom adopts
      // a stripped static vnode. A claimed anchor (an outlet's close marker)
      // is where the server's output stopped, not this node.
      const target =
        isStatic && html === ''
          ? resolveHydrationTarget(currentHydrationNode!)
          : null
      if (target && !isClaimedAnchor(target)) {
        adopted = target
        // a hydrated node carries instance state (SSR fallthrough attrs, slot
        // scope ids), so post-hydration CSR clones come from the parsed html
        // unless that was stripped
        if (!node) node = adopted.cloneNode(true)
        advanceHydrationNode(adopted)
      } else {
        // do not assign `adopted` to `node`, or CSR clones would duplicate children.
        adopted = adoptTemplate(
          currentHydrationNode!,
          html,
          ns,
          !!hydrationCursor,
          (adoptTarget ||= parseAdoptTarget(html, isStatic)),
        )!
      }
      if (root) (adopted as any).$root = rootMeta ||= createRootMeta()
      exitHydrationCursor(hydrationCursor)
      return adopted
    }

    // fast path for text nodes
    if (!node && html[0] !== '<') {
      return createTextNode(html)
    }
    const ret = cloneTemplate((node ||= parseTemplate(html, ns)))
    if (root) (ret as any).$root = rootMeta ||= createRootMeta()
    return ret
  }
}
