import { isValidHTMLNesting } from '@vue/compiler-dom'
import { Namespaces, makeMap } from '@vue/shared'

// Start tags that close an open `<p>` in button scope.
const isPClosingTag = /*@__PURE__*/ makeMap(
  'address,article,aside,blockquote,dd,details,dialog,div,dl,dt,fieldset,' +
    'figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hgroup,hr,li,' +
    'main,menu,nav,ol,p,pre,section,summary,table,ul',
)
const isForeign = (ns: number): boolean => ns !== Namespaces.HTML
// "has an element in scope": the native html tags that end the search.
const isScopeBoundaryTag = /*@__PURE__*/ makeMap(
  'caption,object,select,table,td,th',
)
// Markers in the list of active formatting elements.
const isFormattingMarkerTag = /*@__PURE__*/ makeMap('caption,object,td,th')
// Special elements: they end the search for an open `<li>`, `<dd>` or `<dt>`
// (the parser exempts address, div and p there), and an "any other end tag"
// that reaches one while still open is ignored.
export const isSpecialTag: (tag: string) => boolean = /*@__PURE__*/ makeMap(
  'address,area,article,aside,base,blockquote,body,br,button,caption,col,' +
    'colgroup,dd,details,div,dl,dt,embed,fieldset,figcaption,figure,footer,' +
    'form,h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,iframe,img,input,li,' +
    'link,main,menu,meta,nav,noscript,object,ol,p,param,pre,script,section,' +
    'select,source,style,summary,table,tbody,td,template,textarea,tfoot,th,' +
    'thead,title,tr,track,ul,wbr',
)
const endsListItemSearch = (tag: string): boolean =>
  isSpecialTag(tag) && tag !== 'address' && tag !== 'div' && tag !== 'p'
/**
 * End tags with handling of their own pop whatever is still open below them.
 * Any other end tag is ignored when it meets a special element on its way up
 * the stack, and a formatting end tag runs the adoption agency around one, so
 * under those an open special descendant has to close itself.
 */
export const popsOpenDescendants: (tag: string) => boolean =
  /*@__PURE__*/ makeMap(
    'address,article,aside,blockquote,button,caption,colgroup,dd,details,' +
      'dialog,div,dl,dt,fieldset,figcaption,figure,footer,h1,h2,h3,h4,h5,h6,' +
      'header,hgroup,li,main,menu,nav,object,ol,p,pre,section,summary,table,' +
      'tbody,td,tfoot,th,thead,tr,ul',
  )
/**
 * Html start tags that end foreign content: the parser pops the open svg or
 * mathml elements and inserts these in the html namespace, while vdom creates
 * them in the foreign namespace their ast node carries. Only at html
 * integration points (`foreignObject`, `mi`, ...) do html children stay.
 */
export const isForeignBreakoutTag: (tag: string) => boolean =
  /*@__PURE__*/ makeMap(
    'b,blockquote,body,br,code,dd,div,dl,dt,em,embed,h1,h2,h3,h4,h5,h6,head,' +
      'hr,i,img,li,menu,meta,ol,p,pre,ruby,s,small,span,strong,sub,sup,table,' +
      'u,ul,var',
  )
/**
 * Table parts whose text content other than whitespace the parser
 * foster-parents in front of the table.
 */
export const isFosterParentingTag: (tag: string) => boolean =
  /*@__PURE__*/ makeMap('colgroup,table,tbody,tfoot,thead,tr')
// Elements whose end tag the parser implies before an `<rt>` or `<rp>`.
const isImpliedEndTag = /*@__PURE__*/ makeMap(
  'dd,dt,li,optgroup,option,p,rp,rt',
)

/**
 * What is still open above an element in its template, as far as the start
 * tags that close an ancestor can see: a bit per target, set when the element
 * is entered and cleared at the boundary that ends its search. Passed down
 * from parent to child, so that no element has to walk its ancestors.
 */
export enum OpenScope {
  // a `<p>` in button scope
  P = 1 << 0,
  // a `<button>` in scope
  BUTTON = 1 << 1,
  // a `<ruby>` in scope
  RUBY = 1 << 2,
  // an `<a>` above the last formatting element marker
  A = 1 << 3,
  // a `<form>`: the form element pointer, which no scope resets
  FORM = 1 << 4,
  // an `<li>`, or a `<dd>` or `<dt>`, within the list item search, which a
  // special element other than address, div and p ends
  LI = 1 << 5,
  DD_DT = 1 << 6,
  // not a scope: the element is written into its parent's template (unset
  // when it starts one). Kept in the same field to save one per context.
  SHARED = 1 << 7,
}
// the targets grouped by the kind of scope that ends their search
const IN_BUTTON_SCOPE = OpenScope.P
const IN_SCOPE = OpenScope.BUTTON | OpenScope.RUBY
const BEFORE_MARKER = OpenScope.A
const IN_LIST_ITEM_SEARCH = OpenScope.LI | OpenScope.DD_DT

/**
 * The scope the children of `tag` see, given the scope `tag` itself was
 * written in (0 when it starts a template).
 */
export function enterOpenScope(scope: number, tag: string, ns: number): number {
  if (isForeign(ns)) {
    // html elements sit under a foreign one only at an integration point,
    // which is in every scope list and special, but not a formatting marker
    scope &= ~(IN_BUTTON_SCOPE | IN_SCOPE | IN_LIST_ITEM_SEARCH)
    return scope
  }
  if (isScopeBoundaryTag(tag)) scope &= ~(IN_BUTTON_SCOPE | IN_SCOPE)
  if (isFormattingMarkerTag(tag)) scope &= ~BEFORE_MARKER
  if (endsListItemSearch(tag)) scope &= ~IN_LIST_ITEM_SEARCH
  switch (tag) {
    case 'p':
      return scope | OpenScope.P
    case 'button':
      // button scope ends at a button as well
      return (scope & ~IN_BUTTON_SCOPE) | OpenScope.BUTTON
    case 'ruby':
      return scope | OpenScope.RUBY
    case 'a':
      return scope | OpenScope.A
    case 'form':
      return scope | OpenScope.FORM
    case 'li':
      return scope | OpenScope.LI
    case 'dd':
    case 'dt':
      return scope | OpenScope.DD_DT
  }
  return scope
}

/**
 * Whether the html parser places an element written under `parent` there, so
 * that both can share a template string. Two layers: `isValidHTMLNesting`
 * rejects what the parent itself cannot hold (table, row, select and raw-text
 * content models, void parents), `closesOpenAncestor` the start tags that end
 * an element still open above. The end-tag omission in transformElement
 * assumes only elements passing both share a template.
 */
export function keepsInTemplate(
  tag: string,
  ns: number,
  parentTag: string,
  scope: number,
): boolean {
  return (
    isValidHTMLNesting(parentTag, tag) &&
    !closesOpenAncestor(tag, ns, parentTag, scope)
  )
}

/**
 * Whether the html parser, on the start tag of `tag`, closes an element that
 * is still open above it in the same template - the `<p>` of
 * `<p><span><div>`, the `<li>` of `<li><span><li>`, a link inside a link. The
 * element would then end up elsewhere than the compiler expects, so it has to
 * go into a template of its own. Transcribed from the "in body" insertion mode
 * of https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inbody
 * for the native html tags the compiler knows; `scope` is what the parent
 * leaves open (`enterOpenScope`).
 */
export function closesOpenAncestor(
  tag: string,
  ns: number,
  parentTag: string,
  scope: number,
): boolean {
  if (isForeign(ns)) return false
  if (isPClosingTag(tag) && scope & OpenScope.P) return true
  switch (tag) {
    case 'li':
      return !!(scope & OpenScope.LI)
    case 'dd':
    case 'dt':
      return !!(scope & OpenScope.DD_DT)
    case 'button':
      return !!(scope & OpenScope.BUTTON)
    case 'a':
      return !!(scope & OpenScope.A)
    case 'form':
      return !!(scope & OpenScope.FORM)
    case 'rt':
    case 'rp':
      return !!(scope & OpenScope.RUBY) && isImpliedEndTag(parentTag)
  }
  return false
}
