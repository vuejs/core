import { fromCodePoint } from 'entities/lib/decode.js'
import {
  AttributeNode,
  ConstantTypes,
  DirectiveNode,
  ElementNode,
  ElementTypes,
  Namespaces,
  NodeTypes,
  RootNode,
  SourceLocation,
  TemplateChildNode,
  createRoot
} from '../ast'
import { ParserOptions } from '../options'
import Tokenizer, { CharCodes, QuoteType, isWhitespace } from './Tokenizer'
import { CompilerCompatOptions } from '../compat/compatConfig'
import { NO, extend } from '@vue/shared'
import { defaultOnError, defaultOnWarn } from '../errors'

type OptionalOptions =
  | 'getTextMode' // TODO
  | 'whitespace'
  | 'isNativeTag'
  | 'isBuiltInComponent'
  | keyof CompilerCompatOptions

type MergedParserOptions = Omit<Required<ParserOptions>, OptionalOptions> &
  Pick<ParserOptions, OptionalOptions>

// The default decoder only provides escapes for characters reserved as part of
// the template syntax, and is only used if the custom renderer did not provide
// a platform-specific decoder.
const decodeRE = /&(gt|lt|amp|apos|quot);/g
const decodeMap: Record<string, string> = {
  gt: '>',
  lt: '<',
  amp: '&',
  apos: "'",
  quot: '"'
}

export const defaultParserOptions: MergedParserOptions = {
  delimiters: [`{{`, `}}`],
  getNamespace: () => Namespaces.HTML,
  // getTextMode: () => TextModes.DATA,
  isVoidTag: NO,
  isPreTag: NO,
  isCustomElement: NO,
  decodeEntities: (rawText: string): string =>
    rawText.replace(decodeRE, (_, p1) => decodeMap[p1]),
  onError: defaultOnError,
  onWarn: defaultOnWarn,
  comments: __DEV__
}

let currentOptions: MergedParserOptions = defaultParserOptions
let currentRoot: RootNode = createRoot([])

// parser state
let currentInput = ''
let currentElement: ElementNode | null = null
let currentProp: AttributeNode | DirectiveNode | null = null
let currentAttrValue = ''
let currentAttrStartIndex = -1
let currentAttrEndIndex = -1
let currentAttrs: Set<string> = new Set()
let inPre = 0
// let inVPre = 0
const stack: ElementNode[] = []

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
      endOpenTag(end)
    },

    onclosetag(start, end) {
      const name = getSlice(start, end)
      if (!currentOptions.isVoidTag(name)) {
        const pos = stack.findIndex(e => e.tag === name)
        if (pos !== -1) {
          for (let index = 0; index <= pos; index++) {
            onCloseTag(stack.shift()!, end)
          }
        }
      }
    },

    onselfclosingtag(end) {
      closeCurrentTag(end)
    },

    onattribname(start, end) {
      // plain attribute
      currentProp = {
        type: NodeTypes.ATTRIBUTE,
        name: getSlice(start, end),
        value: undefined,
        loc: getLoc(start)
      }
    },

    ondirname(start, end) {
      // console.log('name ' + getSlice(start, end))
      const raw = getSlice(start, end)
      const name =
        raw === '.' || raw === ':'
          ? 'bind'
          : raw === '@'
          ? 'on'
          : raw === '#'
          ? 'slot'
          : raw.slice(2)
      currentProp = {
        type: NodeTypes.DIRECTIVE,
        name,
        exp: undefined,
        arg: undefined,
        modifiers: [],
        loc: getLoc(start)
      }
    },
    ondirarg(start, end) {
      // console.log('arg ' + getSlice(start, end))
      const arg = getSlice(start, end)
      const isStatic = arg[0] !== `[`
      ;(currentProp as DirectiveNode).arg = {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: arg,
        isStatic,
        constType: isStatic
          ? ConstantTypes.CAN_STRINGIFY
          : ConstantTypes.NOT_CONSTANT,
        loc: getLoc(start, end)
      }
    },
    ondirmodifier(start, end) {
      ;(currentProp as DirectiveNode).modifiers.push(getSlice(start, end))
    },

    onattribdata(start, end) {
      currentAttrValue += getSlice(start, end)
      if (currentAttrStartIndex < 0) currentAttrStartIndex = start
      currentAttrEndIndex = end
    },
    onattribentity(codepoint) {
      currentAttrValue += fromCodePoint(codepoint)
    },
    onattribend(quote, end) {
      // TODO check duplicate
      // if (currentAttrs.has(name)) {
      //   // emit error DUPLICATE_ATTRIBUTE
      // } else {
      //   currentAttrs.add(name)
      // }
      if (currentElement) {
        if (currentAttrValue) {
          if (currentProp!.type === NodeTypes.ATTRIBUTE) {
            // assign value
            currentProp!.value = {
              type: NodeTypes.TEXT,
              content: currentAttrValue,
              loc:
                quote === QuoteType.Unquoted
                  ? getLoc(currentAttrStartIndex, currentAttrEndIndex)
                  : getLoc(currentAttrStartIndex - 1, currentAttrEndIndex + 1)
            }
          } else {
            // directive
            currentProp!.exp = {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: currentAttrValue,
              isStatic: false,
              // Treat as non-constant by default. This can be potentially set
              // to other values by `transformExpression` to make it eligible
              // for hoisting.
              constType: ConstantTypes.NOT_CONSTANT,
              loc: getLoc(currentAttrStartIndex, currentAttrEndIndex)
            }
          }
        }
        currentProp!.loc.end = tokenizer.getPositionForIndex(end)
        currentElement.props.push(currentProp!)
      }
      currentAttrValue = ''
      currentAttrStartIndex = currentAttrEndIndex = -1
    },

    oncomment(start, end, offset) {
      // TODO oncomment
    },

    onend() {
      const end = currentInput.length - 1
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
    ns: currentOptions.getNamespace(name, getParent()),
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
  currentAttrs.clear()
}

function endOpenTag(end: number) {
  addNode(currentElement!)
  const name = currentElement!.tag
  if (!currentOptions.isVoidTag(name)) {
    stack.unshift(currentElement!)
  } else {
    onCloseTag(currentElement!, end)
  }
  currentElement = null
}

function closeCurrentTag(end: number) {
  const name = currentElement!.tag
  endOpenTag(end)
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

function condenseWhitespace(nodes: TemplateChildNode[]): TemplateChildNode[] {
  const shouldCondense = currentOptions.whitespace !== 'preserve'
  let removedWhitespace = false
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.type === NodeTypes.TEXT) {
      if (!inPre) {
        if (isAllWhitespace(node.content)) {
          const prev = nodes[i - 1]?.type
          const next = nodes[i + 1]?.type
          // Remove if:
          // - the whitespace is the first or last node, or:
          // - (condense mode) the whitespace is between two comments, or:
          // - (condense mode) the whitespace is between comment and element, or:
          // - (condense mode) the whitespace is between two elements AND contains newline
          if (
            !prev ||
            !next ||
            (shouldCondense &&
              ((prev === NodeTypes.COMMENT &&
                (next === NodeTypes.COMMENT || next === NodeTypes.ELEMENT)) ||
                (prev === NodeTypes.ELEMENT &&
                  (next === NodeTypes.COMMENT ||
                    (next === NodeTypes.ELEMENT &&
                      hasNewlineChar(node.content))))))
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
          node.content = condense(node.content)
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

function isAllWhitespace(str: string) {
  for (let i = 0; i < str.length; i++) {
    if (!isWhitespace(str.charCodeAt(i))) {
      return false
    }
  }
  return true
}

function hasNewlineChar(str: string) {
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c === CharCodes.NewLine || c === CharCodes.CarriageReturn) {
      return true
    }
  }
  return false
}

function condense(str: string) {
  let ret = ''
  let prevCharIsWhitespace = false
  for (let i = 0; i < str.length; i++) {
    if (isWhitespace(str.charCodeAt(i))) {
      if (!prevCharIsWhitespace) {
        ret += ' '
        prevCharIsWhitespace = true
      }
    } else {
      ret += str[i]
      prevCharIsWhitespace = false
    }
  }
  return ret
}

function addNode(node: TemplateChildNode) {
  getParent().children.push(node)
}

function getParent() {
  return stack[0] || currentRoot
}

function getLoc(start: number, end?: number): SourceLocation {
  return {
    start: tokenizer.getPositionForIndex(start),
    // @ts-expect-error allow late attachment
    end: end && tokenizer.getPositionForIndex(end)
  }
}

function reset() {
  tokenizer.reset()
  currentElement = null
  currentProp = null
  currentAttrs.clear()
  currentAttrValue = ''
  currentAttrStartIndex = -1
  currentAttrEndIndex = -1
  stack.length = 0
}

export function baseParse(input: string, options?: ParserOptions): RootNode {
  reset()
  currentInput = input
  currentOptions = extend({}, defaultParserOptions, options)
  const root = (currentRoot = createRoot([]))
  tokenizer.parse(currentInput)
  root.children = condenseWhitespace(root.children)
  return root
}
