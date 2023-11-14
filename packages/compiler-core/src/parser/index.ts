import { fromCodePoint } from 'entities/lib/decode.js'
import {
  ElementNode,
  ElementTypes,
  NodeTypes,
  RootNode,
  TemplateChildNode,
  createRoot
} from '../ast'
import { ParserOptions } from '../options'
import Tokenizer from './Tokenizer'
import { hasOwn } from '@vue/shared'

const formTags = new Set([
  'input',
  'option',
  'optgroup',
  'select',
  'button',
  'datalist',
  'textarea'
])
const pTag = new Set(['p'])
const tableSectionTags = new Set(['thead', 'tbody'])
const ddtTags = new Set(['dd', 'dt'])
const rtpTags = new Set(['rt', 'rp'])

const openImpliesClose = new Map<string, Set<string>>([
  ['tr', new Set(['tr', 'th', 'td'])],
  ['th', new Set(['th'])],
  ['td', new Set(['thead', 'th', 'td'])],
  ['body', new Set(['head', 'link', 'script'])],
  ['li', new Set(['li'])],
  ['p', pTag],
  ['h1', pTag],
  ['h2', pTag],
  ['h3', pTag],
  ['h4', pTag],
  ['h5', pTag],
  ['h6', pTag],
  ['select', formTags],
  ['input', formTags],
  ['output', formTags],
  ['button', formTags],
  ['datalist', formTags],
  ['textarea', formTags],
  ['option', new Set(['option'])],
  ['optgroup', new Set(['optgroup', 'option'])],
  ['dd', ddtTags],
  ['dt', ddtTags],
  ['address', pTag],
  ['article', pTag],
  ['aside', pTag],
  ['blockquote', pTag],
  ['details', pTag],
  ['div', pTag],
  ['dl', pTag],
  ['fieldset', pTag],
  ['figcaption', pTag],
  ['figure', pTag],
  ['footer', pTag],
  ['form', pTag],
  ['header', pTag],
  ['hr', pTag],
  ['main', pTag],
  ['nav', pTag],
  ['ol', pTag],
  ['pre', pTag],
  ['section', pTag],
  ['table', pTag],
  ['ul', pTag],
  ['rt', rtpTags],
  ['rp', rtpTags],
  ['tbody', tableSectionTags],
  ['tfoot', tableSectionTags]
])

const voidElements = new Set([
  'area',
  'base',
  'basefont',
  'br',
  'col',
  'command',
  'embed',
  'frame',
  'hr',
  'img',
  'input',
  'isindex',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

const foreignContextElements = new Set(['math', 'svg'])

const htmlIntegrationElements = new Set([
  'mi',
  'mo',
  'mn',
  'ms',
  'mtext',
  'annotation-xml',
  'foreignobject',
  'desc',
  'title'
])

let currentOptions: ParserOptions = {}
let currentRoot: RootNode = createRoot([])
let elementStack: ElementNode[] = []

// parser state
let htmlMode = false
let currentInput = ''
let openTagStart = 0
let tagname = ''
let attribname = ''
let attribvalue = ''
let attribs: Record<string, string> | null = null
let startIndex = 0
let endIndex = 0
let inPre = 0
// let inVPre = 0
const stack: string[] = []
const foreignContext: boolean[] = [false]

const tokenizer = new Tokenizer(
  // TODO handle entities
  { decodeEntities: true },
  {
    ontext(start, end) {
      onText(getSlice(start, end), start, end)
    },

    ontextentity(cp, end) {
      onText(fromCodePoint(cp), end - 1, end)
    },

    onopentagname(start, end) {
      emitOpenTag(getSlice(start, (endIndex = end)))
    },

    onopentagend(end) {
      endIndex = end
      endOpenTag(false)
      startIndex = end + 1
    },

    onclosetag(start, end) {
      endIndex = end
      const name = getSlice(start, end)

      if (
        htmlMode &&
        (foreignContextElements.has(name) || htmlIntegrationElements.has(name))
      ) {
        foreignContext.shift()
      }

      if (!voidElements.has(name)) {
        const pos = stack.indexOf(name)
        if (pos !== -1) {
          for (let index = 0; index <= pos; index++) {
            stack.shift()
            onCloseTag()
          }
        } else if (htmlMode && name === 'p') {
          // Implicit open before close
          emitOpenTag('p')
          closeCurrentTag(true)
        }
      } else if (htmlMode && name === 'br') {
        // TODO
        // We can't use `emitOpenTag` for implicit open, as `br` would be implicitly closed.
        // this.cbs.onopentag?.('br', {}, true)
        // this.cbs.onclosetag?.('br', false)
      }

      // Set `startIndex` for next node
      startIndex = end + 1
    },

    onselfclosingtag(end) {
      endIndex = end
      closeCurrentTag(false)
      startIndex = end + 1
    },

    onattribname(start, end) {
      attribname = getSlice((startIndex = start), end)
    },
    onattribdata(start, end) {
      attribvalue += getSlice(start, end)
    },
    onattribentity(codepoint) {
      attribvalue += fromCodePoint(codepoint)
    },
    onattribend(_quote, end) {
      endIndex = end
      if (attribs && !hasOwn(attribs, attribname)) {
        // TODO gen attributes AST nodes
        attribs[attribname] = attribvalue
      }
      attribvalue = ''
    },

    oncomment(start, end, offset) {
      endIndex = end
      // TODO oncomment
      startIndex = end + 1
    },

    onend() {
      // Set the end index for all remaining tags
      endIndex = startIndex
      for (let index = 0; index < stack.length; index++) {
        onCloseTag()
      }
    },

    oncdata(start, end, offset) {
      endIndex = end
      // TODO throw error
      startIndex = end + 1
    }
  }
)

function getSlice(start: number, end: number) {
  return currentInput.slice(start, end)
}

function emitOpenTag(name: string) {
  openTagStart = startIndex
  tagname = name
  const impliesClose = htmlMode && openImpliesClose.get(name)
  if (impliesClose) {
    while (stack.length > 0 && impliesClose.has(stack[0])) {
      stack.shift()
      onCloseTag()
    }
  }
  if (!voidElements.has(name)) {
    stack.unshift(name)
    if (htmlMode) {
      if (foreignContextElements.has(name)) {
        foreignContext.unshift(true)
      } else if (htmlIntegrationElements.has(name)) {
        foreignContext.unshift(false)
      }
    }
  }
  attribs = {}
}

function closeCurrentTag(isOpenImplied: boolean) {
  const name = tagname
  endOpenTag(isOpenImplied)
  if (stack[0] === name) {
    onCloseTag()
    stack.shift()
  }
}

function endOpenTag(isImplied: boolean) {
  startIndex = openTagStart
  if (attribs) {
    onOpenTag(tagname)
    attribs = null
  }
  if (voidElements.has(tagname)) {
    onCloseTag()
  }
  tagname = ''
}

function onText(content: string, start: number, end: number) {
  const parent = getParent()
  const lastNode = parent.children[parent.children.length - 1]
  if (lastNode?.type === NodeTypes.TEXT) {
    // merge
    lastNode.content += content
    // TODO update loc
  } else {
    parent.children.push({
      type: NodeTypes.TEXT,
      content,
      loc: {
        start: tokenizer.getPositionForIndex(start),
        end: tokenizer.getPositionForIndex(end),
        source: content
      }
    })
  }
}

function onOpenTag(tag: string) {
  const el: ElementNode = {
    type: NodeTypes.ELEMENT,
    tag,
    // TODO namespace
    ns: 0,
    // TODO refine tag type
    tagType: ElementTypes.ELEMENT,
    // TODO props
    props: [],
    children: [],
    loc: {
      // @ts-expect-error TODO
      start: {},
      // @ts-expect-error TODO
      end: { offset: endIndex },
      source: ''
    },
    codegenNode: undefined
  }
  addNode(el)
  elementStack.push(el)
}

function onCloseTag() {
  const el = elementStack.pop()!
  // whitepsace management
  el.children = condenseWhitespace(el.children)
}

const windowsNewlineRE = /\r\n/g
const consecutiveWhitespaceRE = /[\t\r\n\f ]+/g
const nonWhitespaceRE = /[^\t\r\n\f ]/

function isEmptyText(content: string) {
  return !nonWhitespaceRE.test(content)
}

function condenseWhitespace(nodes: TemplateChildNode[]): TemplateChildNode[] {
  const shouldCondense = currentOptions.whitespace !== 'preserve'
  let removedWhitespace = false
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.type === NodeTypes.TEXT) {
      if (!inPre) {
        if (isEmptyText(node.content)) {
          const prev = nodes[i - 1]
          const next = nodes[i + 1]
          // Remove if:
          // - the whitespace is the first or last node, or:
          // - (condense mode) the whitespace is between twos comments, or:
          // - (condense mode) the whitespace is between comment and element, or:
          // - (condense mode) the whitespace is between two elements AND contains newline
          if (
            !prev ||
            !next ||
            (shouldCondense &&
              ((prev.type === NodeTypes.COMMENT &&
                next.type === NodeTypes.COMMENT) ||
                (prev.type === NodeTypes.COMMENT &&
                  next.type === NodeTypes.ELEMENT) ||
                (prev.type === NodeTypes.ELEMENT &&
                  next.type === NodeTypes.COMMENT) ||
                (prev.type === NodeTypes.ELEMENT &&
                  next.type === NodeTypes.ELEMENT &&
                  /[\r\n]/.test(node.content))))
          ) {
            removedWhitespace = true
            nodes[i] = null as any
          } else {
            // Otherwise, the whitespace is condensed into a single space
            node.content = ' '
          }
        } else if (shouldCondense) {
          // in condense mode, consecutive whitespaces in text are condensed
          // down to a single space.
          node.content = node.content.replace(consecutiveWhitespaceRE, ' ')
        }
      } else {
        // #6410 normalize windows newlines in <pre>:
        // in SSR, browsers normalize server-rendered \r\n into a single \n
        // in the DOM
        node.content = node.content.replace(windowsNewlineRE, '\n')
      }
    }
  }
  return removedWhitespace ? nodes.filter(Boolean) : nodes
}

function addNode(node: TemplateChildNode) {
  getParent().children.push(node)
}

function getParent() {
  return elementStack[elementStack.length - 1] || currentRoot
}

function reset() {
  tokenizer.reset()
  tagname = ''
  attribname = ''
  attribvalue = ''
  attribs = null
  startIndex = 0
  endIndex = 0
  stack.length = 0
  elementStack.length = 0
  foreignContext.length = 1
  foreignContext[0] = false
}

export function baseParse(
  input: string,
  options: ParserOptions = {}
): RootNode {
  reset()
  currentInput = input
  currentOptions = options
  htmlMode = !!options.htmlMode
  const root = (currentRoot = createRoot([]))
  tokenizer.parse(currentInput)
  root.children = condenseWhitespace(root.children)
  return root
}
