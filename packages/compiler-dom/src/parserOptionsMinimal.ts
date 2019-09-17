import {
  NodeTypes,
  TextModes,
  ParserOptions,
  ElementNode,
  Namespaces
} from '@vue/compiler-core'

export const enum DOMNamespaces {
  HTML = Namespaces.HTML,
  SVG,
  MATH_ML
}

const MATH_ML_TEXT_INTEGRATION_POINT_RE = /^m(?:[ions]|text)$/
const RAW_TEXT_CONTAINER_RE = /^(?:style|xmp|iframe|noembed|noframes|script|noscript)$/i
const VOID_TAG_RE = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i

export const parserOptionsMinimal: ParserOptions = {
  // https://html.spec.whatwg.org/multipage/parsing.html#tree-construction-dispatcher
  getNamespace(tag: string, parent: ElementNode | undefined): DOMNamespaces {
    let ns = parent ? parent.ns : DOMNamespaces.HTML

    if (parent && ns === DOMNamespaces.MATH_ML) {
      if (parent.tag === 'annotation-xml') {
        if (tag === 'svg') {
          return DOMNamespaces.SVG
        }
        if (
          parent.props.some(
            a =>
              a.type === NodeTypes.ATTRIBUTE &&
              a.name === 'encoding' &&
              a.value != null &&
              (a.value.content === 'text/html' ||
                a.value.content === 'application/xhtml+xml')
          )
        ) {
          ns = DOMNamespaces.HTML
        }
      } else if (
        MATH_ML_TEXT_INTEGRATION_POINT_RE.test(parent.tag) &&
        tag !== 'mglyph' &&
        tag !== 'malignmark'
      ) {
        ns = DOMNamespaces.HTML
      }
    } else if (parent && ns === DOMNamespaces.SVG) {
      if (
        parent.tag === 'foreignObject' ||
        parent.tag === 'desc' ||
        parent.tag === 'title'
      ) {
        ns = DOMNamespaces.HTML
      }
    }

    if (ns === DOMNamespaces.HTML) {
      if (tag === 'svg') {
        return DOMNamespaces.SVG
      }
      if (tag === 'math') {
        return DOMNamespaces.MATH_ML
      }
    }
    return ns
  },

  // https://html.spec.whatwg.org/multipage/parsing.html#parsing-html-fragments
  getTextMode(tag: string, ns: DOMNamespaces): TextModes {
    if (ns === DOMNamespaces.HTML) {
      if (tag === 'textarea' || tag === 'title') {
        return TextModes.RCDATA
      }
      if (RAW_TEXT_CONTAINER_RE.test(tag)) {
        return TextModes.RAWTEXT
      }
    }
    return TextModes.DATA
  },

  isVoidTag(tag: string): boolean {
    return VOID_TAG_RE.test(tag)
  }
}
