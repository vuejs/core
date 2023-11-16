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
  SimpleExpressionNode,
  SourceLocation,
  TemplateChildNode,
  createRoot
} from '../ast'
import { ParserOptions } from '../options'
import Tokenizer, { CharCodes, QuoteType, isWhitespace } from './Tokenizer'
import { CompilerCompatOptions } from '../compat/compatConfig'
import { NO, extend } from '@vue/shared'
import { defaultOnError, defaultOnWarn } from '../errors'
import { isCoreComponent } from '../utils'
import { TextModes } from '../parse'

type OptionalOptions =
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
  getTextMode: () => TextModes.DATA,
  isVoidTag: NO,
  isPreTag: NO,
  isCustomElement: NO,
  // TODO handle entities
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
let inVPre = false
let currentElementIsVPreBoundary = false
const stack: ElementNode[] = []

const tokenizer = new Tokenizer({
  ontext(start, end) {
    onText(getSlice(start, end), start, end)
  },

  ontextentity(cp, end) {
    onText(fromCodePoint(cp), end - 1, end)
  },

  oninterpolation(start, end) {
    if (inVPre) {
      return onText(getSlice(start, end), start, end)
    }
    let innerStart = start + tokenizer.delimiterOpen.length
    let innerEnd = end - tokenizer.delimiterClose.length
    while (isWhitespace(currentInput.charCodeAt(innerStart))) {
      innerStart++
    }
    while (isWhitespace(currentInput.charCodeAt(innerEnd - 1))) {
      innerEnd--
    }
    addNode({
      type: NodeTypes.INTERPOLATION,
      content: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        isStatic: false,
        // Set `isConstant` to false by default and will decide in transformExpression
        constType: ConstantTypes.NOT_CONSTANT,
        content: getSlice(innerStart, innerEnd),
        loc: getLoc(innerStart, innerEnd)
      },
      loc: getLoc(start, end)
    })
  },

  onopentagname(start, end) {
    const name = getSlice(start, end)
    currentElement = {
      type: NodeTypes.ELEMENT,
      tag: name,
      ns: currentOptions.getNamespace(name, getParent()),
      tagType: ElementTypes.ELEMENT, // will be refined on tag close
      props: [],
      children: [],
      loc: {
        start: tokenizer.getPos(start - 1),
        // @ts-expect-error to be attached on tag close
        end: undefined,
        source: ''
      },
      codegenNode: undefined
    }
    currentAttrs.clear()
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
    const raw = getSlice(start, end)
    if (inVPre) {
      currentProp = {
        type: NodeTypes.ATTRIBUTE,
        name: raw,
        value: undefined,
        loc: getLoc(start)
      }
    } else {
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
        raw,
        exp: undefined,
        arg: undefined,
        modifiers: [],
        loc: getLoc(start)
      }
      if (name === 'pre') {
        inVPre = true
        currentElementIsVPreBoundary = true
        // convert dirs before this one to attributes
        const props = currentElement!.props
        for (let i = 0; i < props.length; i++) {
          if (props[i].type === NodeTypes.DIRECTIVE) {
            props[i] = dirToAttr(props[i] as DirectiveNode)
          }
        }
      }
    }
  },

  ondirarg(start, end) {
    const arg = getSlice(start, end)
    if (inVPre) {
      ;(currentProp as AttributeNode).name += arg
    } else {
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
    }
  },

  ondirmodifier(start, end) {
    const mod = getSlice(start, end)
    if (inVPre) {
      ;(currentProp as AttributeNode).name += '.' + mod
    } else {
      ;(currentProp as DirectiveNode).modifiers.push(mod)
    }
  },

  onattribdata(start, end) {
    currentAttrValue += getSlice(start, end)
    if (currentAttrStartIndex < 0) currentAttrStartIndex = start
    currentAttrEndIndex = end
  },

  onattribentity(codepoint) {
    currentAttrValue += fromCodePoint(codepoint)
  },

  onattribnameend(end) {
    // check duplicate attrs
    const start = currentProp!.loc.start.offset
    const name = getSlice(start, end)
    if (currentProp!.type === NodeTypes.DIRECTIVE) {
      currentProp!.raw = name
    }
    if (currentAttrs.has(name)) {
      currentProp = null
      // TODO emit error DUPLICATE_ATTRIBUTE
      throw new Error(`duplicate attr ${name}`)
    } else {
      currentAttrs.add(name)
    }
  },

  onattribend(quote, end) {
    if (currentElement && currentProp) {
      if (currentAttrValue) {
        if (currentProp.type === NodeTypes.ATTRIBUTE) {
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
          currentProp.exp = {
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
      currentProp.loc.end = tokenizer.getPos(end)
      if (
        currentProp.type !== NodeTypes.DIRECTIVE ||
        currentProp.name !== 'pre'
      ) {
        currentElement.props.push(currentProp)
      }
    }
    currentAttrValue = ''
    currentAttrStartIndex = currentAttrEndIndex = -1
  },

  oncomment(start, end) {
    if (currentOptions.comments) {
      addNode({
        type: NodeTypes.COMMENT,
        content: getSlice(start, end),
        loc: getLoc(start - 4, end + 3)
      })
    }
  },

  onend() {
    const end = currentInput.length - 1
    for (let index = 0; index < stack.length; index++) {
      onCloseTag(stack[index], end)
    }
  },

  oncdata(start, end) {
    // TODO throw error
  }
})

function getSlice(start: number, end: number) {
  return currentInput.slice(start, end)
}

function endOpenTag(end: number) {
  addNode(currentElement!)
  const name = currentElement!.tag
  if (currentOptions.isPreTag(name)) {
    inPre++
  }
  if (currentOptions.isVoidTag(name)) {
    onCloseTag(currentElement!, end)
  } else {
    stack.unshift(currentElement!)
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
    lastNode.loc.end = tokenizer.getPos(end)
  } else {
    parent.children.push({
      type: NodeTypes.TEXT,
      content,
      loc: {
        start: tokenizer.getPos(start),
        end: tokenizer.getPos(end),
        source: ''
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
  el.loc.end = tokenizer.getPos(end + offset + 1)

  // refine element type
  const tag = el.tag
  if (!inVPre) {
    if (tag === 'slot') {
      el.tagType = ElementTypes.SLOT
    } else if (isFragmentTemplate(el)) {
      el.tagType = ElementTypes.TEMPLATE
    } else if (isComponent(el)) {
      el.tagType = ElementTypes.COMPONENT
    }
  }

  // whitepsace management
  el.children = condenseWhitespace(el.children)

  if (currentOptions.isPreTag(tag)) {
    inPre--
  }
  if (currentElementIsVPreBoundary) {
    inVPre = false
    currentElementIsVPreBoundary = false
  }
}

const specialTemplateDir = new Set(['if', 'else', 'else-if', 'for', 'slot'])
function isFragmentTemplate({ tag, props }: ElementNode): boolean {
  if (tag === 'template') {
    for (let i = 0; i < props.length; i++) {
      if (
        props[i].type === NodeTypes.DIRECTIVE &&
        specialTemplateDir.has(props[i].name)
      ) {
        return true
      }
    }
  }
  return false
}

function isComponent({ tag, props }: ElementNode): boolean {
  if (currentOptions.isCustomElement(tag)) {
    return false
  }
  if (
    tag === 'component' ||
    isUpperCase(tag.charCodeAt(0)) ||
    isCoreComponent(tag) ||
    currentOptions.isBuiltInComponent?.(tag) ||
    !currentOptions.isNativeTag?.(tag)
  ) {
    return true
  }
  // at this point the tag should be a native tag, but check for potential "is"
  // casting
  for (let i = 0; i < props.length; i++) {
    const p = props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      if (p.name === 'is' && p.value) {
        if (p.value.content.startsWith('vue:')) {
          return true
        }
        // TODO else if (
        //   __COMPAT__ &&
        //   checkCompatEnabled(
        //     CompilerDeprecationTypes.COMPILER_IS_ON_ELEMENT,
        //     context,
        //     p.loc
        //   )
        // ) {
        //   return true
        // }
      }
    }
    // TODO else if (
    //   __COMPAT__ &&
    //   // :is on plain element - only treat as component in compat mode
    //   p.name === 'bind' &&
    //   isStaticArgOf(p.arg, 'is') &&
    //   checkCompatEnabled(
    //     CompilerDeprecationTypes.COMPILER_IS_ON_ELEMENT,
    //     context,
    //     p.loc
    //   )
    // ) {
    //   return true
    // }
  }
  return false
}

function isUpperCase(c: number) {
  return c > 64 && c < 91
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
    start: tokenizer.getPos(start),
    // @ts-expect-error allow late attachment
    end: end && tokenizer.getPos(end)
  }
}

function dirToAttr(dir: DirectiveNode): AttributeNode {
  const attr: AttributeNode = {
    type: NodeTypes.ATTRIBUTE,
    name: dir.raw!,
    value: undefined,
    loc: dir.loc
  }
  if (dir.exp) {
    // account for quotes
    const loc = dir.exp.loc
    if (loc.end.offset < dir.loc.end.offset) {
      loc.start.offset--
      loc.start.column--
      loc.end.offset++
      loc.end.column++
    }
    attr.value = {
      type: NodeTypes.TEXT,
      content: (dir.exp as SimpleExpressionNode).content,
      loc
    }
  }
  return attr
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

function toCharCodes(str: string): Uint8Array {
  const ret = new Uint8Array()
  for (let i = 0; i < str.length; i++) {
    ret[i] = str.charCodeAt(i)
  }
  return ret
}

export function baseParse(input: string, options?: ParserOptions): RootNode {
  reset()
  const delimiters = options?.delimiters
  if (delimiters) {
    tokenizer.delimiterOpen = toCharCodes(delimiters[0])
    tokenizer.delimiterClose = toCharCodes(delimiters[1])
  }
  currentInput = input
  currentOptions = extend({}, defaultParserOptions, options)
  const root = (currentRoot = createRoot([]))
  tokenizer.parse(currentInput)
  root.loc.end = tokenizer.getPos(input.length)
  root.children = condenseWhitespace(root.children)
  return root
}
