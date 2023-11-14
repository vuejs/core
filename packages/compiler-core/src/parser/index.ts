import { fromCodePoint } from 'entities/lib/decode.js'
import {
  AttributeNode,
  DirectiveNode,
  ElementNode,
  ElementTypes,
  NodeTypes,
  RootNode,
  TemplateChildNode,
  createRoot
} from '../ast'
import { ParserOptions } from '../options'
import Tokenizer, { CharCodes } from './Tokenizer'

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

// parser state
let htmlMode = false
let currentInput = ''
let currentElement: ElementNode | null = null
let currentProp: AttributeNode | DirectiveNode | null = null
let currentAttrValue = ''
let inPre = 0
// let inVPre = 0
const stack: ElementNode[] = []
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
      emitOpenTag(getSlice(start, end), start)
    },

    onopentagend(end) {
      endOpenTag()
    },

    onclosetag(start, end) {
      const name = getSlice(start, end)

      if (
        htmlMode &&
        (foreignContextElements.has(name) || htmlIntegrationElements.has(name))
      ) {
        foreignContext.shift()
      }

      if (!voidElements.has(name)) {
        const pos = stack.findIndex(e => e.tag === name)
        if (pos !== -1) {
          for (let index = 0; index <= pos; index++) {
            onCloseTag(stack.shift()!, end)
          }
        } else if (htmlMode && name === 'p') {
          // Implicit open before close
          emitOpenTag('p', start)
          closeCurrentTag(end)
        }
      } else if (htmlMode && name === 'br') {
        // TODO
        // We can't use `emitOpenTag` for implicit open, as `br` would be implicitly closed.
        // this.cbs.onopentag?.('br', {}, true)
        // this.cbs.onclosetag?.('br', false)
      }
    },

    onselfclosingtag(end) {
      closeCurrentTag(end)
    },

    onattribname(start, end) {
      // TODO directives
      currentProp = {
        type: NodeTypes.ATTRIBUTE,
        name: getSlice(start, end),
        value: undefined,
        loc: {
          start: tokenizer.getPositionForIndex(start),
          // @ts-expect-error to be attached on attribute end
          end: undefined,
          source: ''
        }
      }
    },
    onattribdata(start, end) {
      currentAttrValue += getSlice(start, end)
    },
    onattribentity(codepoint) {
      currentAttrValue += fromCodePoint(codepoint)
    },
    onattribend(_quote, end) {
      if (currentElement) {
        if (currentProp!.type === NodeTypes.ATTRIBUTE) {
          // assign value
          currentProp!.value = {
            type: NodeTypes.TEXT,
            content: currentAttrValue,
            // @ts-expect-error TODO
            loc: {}
          }
        } else {
          // TODO
        }
        currentProp!.loc.end = tokenizer.getPositionForIndex(end)
        currentElement.props.push(currentProp!)
      }
      currentAttrValue = ''
    },

    oncomment(start, end, offset) {
      // TODO oncomment
    },

    onend() {
      const end = currentInput.length
      for (let index = 0; index < stack.length; index++) {
        onCloseTag(stack[index], end)
      }
    },

    oncdata(start, end, offset) {
      // TODO throw error
    }
  }
)

function getSlice(start: number, end: number) {
  return currentInput.slice(start, end)
}

function emitOpenTag(name: string, start: number) {
  currentElement = {
    type: NodeTypes.ELEMENT,
    tag: name,
    // TODO refine namespace
    ns: 0,
    // TODO refine tag type
    tagType: ElementTypes.ELEMENT,
    props: [],
    children: [],
    loc: {
      start: tokenizer.getPositionForIndex(start - 1),
      // @ts-expect-error to be attached on tag close
      end: undefined,
      source: ''
    },
    codegenNode: undefined
  }
}

function endOpenTag() {
  addNode(currentElement!)
  const name = currentElement!.tag
  if (!voidElements.has(name)) {
    stack.unshift(currentElement!)
    if (htmlMode) {
      if (foreignContextElements.has(name)) {
        foreignContext.unshift(true)
      } else if (htmlIntegrationElements.has(name)) {
        foreignContext.unshift(false)
      }
    }
  }
  currentElement = null
}

function closeCurrentTag(end: number) {
  const name = currentElement!.tag
  endOpenTag()
  if (stack[0].tag === name) {
    onCloseTag(stack.shift()!, end)
  }
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

function onCloseTag(el: ElementNode, end: number) {
  // attach end position
  let offset = 0
  while (currentInput.charCodeAt(end + offset) !== CharCodes.Gt) {
    offset++
  }
  el.loc.end = tokenizer.getPositionForIndex(end + offset + 1)
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
  return stack[0] || currentRoot
}

function reset() {
  tokenizer.reset()
  currentElement = null
  currentProp = null
  currentAttrValue = ''
  stack.length = 0
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
