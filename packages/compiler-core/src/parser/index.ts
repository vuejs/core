import {
  AttributeNode,
  ConstantTypes,
  DirectiveNode,
  ElementNode,
  ElementTypes,
  ForParseResult,
  Namespaces,
  NodeTypes,
  RootNode,
  SimpleExpressionNode,
  SourceLocation,
  TemplateChildNode,
  createRoot,
  createSimpleExpression
} from '../ast'
import { ParserOptions } from '../options'
import Tokenizer, {
  CharCodes,
  ParseMode,
  QuoteType,
  isWhitespace,
  toCharCodes
} from './Tokenizer'
import { CompilerCompatOptions } from '../compat/compatConfig'
import { NO, extend } from '@vue/shared'
import { defaultOnError, defaultOnWarn } from '../errors'
import { forAliasRE, isCoreComponent } from '../utils'
import { decodeHTML } from 'entities/lib/decode.js'

type OptionalOptions =
  | 'decodeEntities'
  | 'whitespace'
  | 'isNativeTag'
  | 'isBuiltInComponent'
  | keyof CompilerCompatOptions

type MergedParserOptions = Omit<Required<ParserOptions>, OptionalOptions> &
  Pick<ParserOptions, OptionalOptions>

export const defaultParserOptions: MergedParserOptions = {
  parseMode: 'base',
  delimiters: [`{{`, `}}`],
  getNamespace: () => Namespaces.HTML,
  isVoidTag: NO,
  isPreTag: NO,
  isCustomElement: NO,
  onError: defaultOnError,
  onWarn: defaultOnWarn,
  comments: __DEV__
}

let currentOptions: MergedParserOptions = defaultParserOptions
let currentRoot: RootNode | null = null

// parser state
let currentInput = ''
let currentElement: ElementNode | null = null
let currentProp: AttributeNode | DirectiveNode | null = null
let currentAttrValue = ''
let currentAttrStartIndex = -1
let currentAttrEndIndex = -1
let inPre = 0
let inVPre = false
let currentVPreBoundary: ElementNode | null = null
const stack: ElementNode[] = []

const tokenizer = new Tokenizer(stack, {
  ontext(start, end) {
    onText(getSlice(start, end), start, end)
  },

  ontextentity(char, start, end) {
    onText(char, start, end)
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
    let exp = getSlice(innerStart, innerEnd)
    // decode entities for backwards compat
    if (exp.includes('&')) {
      if (__BROWSER__) {
        exp = currentOptions.decodeEntities!(exp, false)
      } else {
        exp = decodeHTML(exp)
      }
    }
    addNode({
      type: NodeTypes.INTERPOLATION,
      content: createSimpleExpression(exp, false, getLoc(innerStart, innerEnd)),
      loc: getLoc(start, end)
    })
  },

  onopentagname(start, end) {
    const name = getSlice(start, end)
    currentElement = {
      type: NodeTypes.ELEMENT,
      tag: name,
      ns: currentOptions.getNamespace(name, stack[0]),
      tagType: ElementTypes.ELEMENT, // will be refined on tag close
      props: [],
      children: [],
      loc: getLoc(start - 1),
      codegenNode: undefined
    }
  },

  onopentagend(end) {
    endOpenTag(end)
  },

  onclosetag(start, end) {
    const name = getSlice(start, end)
    if (!currentOptions.isVoidTag(name)) {
      for (let i = 0; i < stack.length; i++) {
        const e = stack[i]
        if (e.tag.toLowerCase() === name.toLowerCase()) {
          for (let j = 0; j <= i; j++) {
            onCloseTag(stack.shift()!, end)
          }
          break
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
      nameLoc: getLoc(start, end),
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
        nameLoc: getLoc(start, end),
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
        rawName: raw,
        exp: undefined,
        rawExp: undefined,
        arg: undefined,
        modifiers: raw === '.' ? ['prop'] : [],
        loc: getLoc(start)
      }
      if (name === 'pre') {
        inVPre = true
        currentVPreBoundary = currentElement
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
      ;(currentProp as AttributeNode).nameLoc.end = tokenizer.getPos(end)
    } else {
      const isStatic = arg[0] !== `[`
      ;(currentProp as DirectiveNode).arg = createSimpleExpression(
        isStatic ? arg : arg.slice(1, -1),
        isStatic,
        getLoc(start, end),
        isStatic ? ConstantTypes.CAN_STRINGIFY : ConstantTypes.NOT_CONSTANT
      )
    }
  },

  ondirmodifier(start, end) {
    const mod = getSlice(start, end)
    if (inVPre) {
      ;(currentProp as AttributeNode).name += '.' + mod
      ;(currentProp as AttributeNode).nameLoc.end = tokenizer.getPos(end)
    } else if ((currentProp as DirectiveNode).name === 'slot') {
      // slot has no modifiers, special case for edge cases like
      // https://github.com/vuejs/language-tools/issues/2710
      const arg = (currentProp as DirectiveNode).arg
      if (arg) {
        ;(arg as SimpleExpressionNode).content += '.' + mod
        arg.loc.end = tokenizer.getPos(end)
      }
    } else {
      ;(currentProp as DirectiveNode).modifiers.push(mod)
    }
  },

  onattribdata(start, end) {
    currentAttrValue += getSlice(start, end)
    if (currentAttrStartIndex < 0) currentAttrStartIndex = start
    currentAttrEndIndex = end
  },

  onattribentity(char, start, end) {
    currentAttrValue += char
    if (currentAttrStartIndex < 0) currentAttrStartIndex = start
    currentAttrEndIndex = end
  },

  onattribnameend(end) {
    const start = currentProp!.loc.start.offset
    const name = getSlice(start, end)
    if (currentProp!.type === NodeTypes.DIRECTIVE) {
      currentProp!.rawName = name
    }
    // check duplicate attrs
    if (
      currentElement!.props.some(
        p => (p.type === NodeTypes.DIRECTIVE ? p.rawName : p.name) === name
      )
    ) {
      // TODO duplicate
    }
  },

  onattribend(quote, end) {
    if (currentElement && currentProp) {
      if (quote !== QuoteType.NoValue) {
        if (__BROWSER__ && currentAttrValue.includes('&')) {
          // TODO should not do this in <script> or <style>
          currentAttrValue = currentOptions.decodeEntities!(
            currentAttrValue,
            true
          )
        }
        if (currentProp.type === NodeTypes.ATTRIBUTE) {
          // assign value

          // condense whitespaces in class
          if (currentProp!.name === 'class') {
            currentAttrValue = condense(currentAttrValue).trim()
          }

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
          currentProp.rawExp = currentAttrValue
          currentProp.exp = createSimpleExpression(
            currentAttrValue,
            false,
            getLoc(currentAttrStartIndex, currentAttrEndIndex)
          )
          if (currentProp.name === 'for') {
            currentProp.forParseResult = parseForExpression(currentProp.exp)
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
    if (stack[0].ns !== Namespaces.HTML) {
      onText(getSlice(start, end), start, end)
    } else {
      // TODO throw error if ns is html
    }
  }
})

// This regex doesn't cover the case if key or index aliases have destructuring,
// but those do not make sense in the first place, so this works in practice.
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g

function parseForExpression(
  input: SimpleExpressionNode
): ForParseResult | undefined {
  const loc = input.loc
  const exp = input.content
  const inMatch = exp.match(forAliasRE)
  if (!inMatch) return

  const [, LHS, RHS] = inMatch

  const createAliasExpression = (content: string, offset: number) => {
    const start = loc.start.offset + offset
    const end = start + content.length
    return createSimpleExpression(content, false, getLoc(start, end))
  }

  const result: ForParseResult = {
    source: createAliasExpression(RHS.trim(), exp.indexOf(RHS, LHS.length)),
    value: undefined,
    key: undefined,
    index: undefined,
    finalized: false
  }

  let valueContent = LHS.trim().replace(stripParensRE, '').trim()
  const trimmedOffset = LHS.indexOf(valueContent)

  const iteratorMatch = valueContent.match(forIteratorRE)
  if (iteratorMatch) {
    valueContent = valueContent.replace(forIteratorRE, '').trim()

    const keyContent = iteratorMatch[1].trim()
    let keyOffset: number | undefined
    if (keyContent) {
      keyOffset = exp.indexOf(keyContent, trimmedOffset + valueContent.length)
      result.key = createAliasExpression(keyContent, keyOffset)
    }

    if (iteratorMatch[2]) {
      const indexContent = iteratorMatch[2].trim()

      if (indexContent) {
        result.index = createAliasExpression(
          indexContent,
          exp.indexOf(
            indexContent,
            result.key
              ? keyOffset! + keyContent.length
              : trimmedOffset + valueContent.length
          )
        )
      }
    }
  }

  if (valueContent) {
    result.value = createAliasExpression(valueContent, trimmedOffset)
  }

  return result
}

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
  if (__BROWSER__ && content.includes('&')) {
    // TODO do not do this in <script> or <style>
    content = currentOptions.decodeEntities!(content, false)
  }
  const parent = stack[0] || currentRoot
  const lastNode = parent.children[parent.children.length - 1]
  if (lastNode?.type === NodeTypes.TEXT) {
    // merge
    lastNode.content += content
    lastNode.loc.end = tokenizer.getPos(end)
  } else {
    parent.children.push({
      type: NodeTypes.TEXT,
      content,
      loc: getLoc(start, end)
    })
  }
}

function onCloseTag(el: ElementNode, end: number) {
  // attach end position
  let offset = 0
  while (
    currentInput.charCodeAt(end + offset) !== CharCodes.Gt &&
    end + offset < currentInput.length
  ) {
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
  if (!tokenizer.inRCDATA) {
    el.children = condenseWhitespace(el.children, el.tag)
  }

  if (currentOptions.isPreTag(tag)) {
    inPre--
  }
  if (currentVPreBoundary === el) {
    inVPre = false
    currentVPreBoundary = null
  }
}

const specialTemplateDir = new Set(['if', 'else', 'else-if', 'for', 'slot'])
function isFragmentTemplate({ tag, props }: ElementNode): boolean {
  if (tag === 'template') {
    for (let i = 0; i < props.length; i++) {
      if (
        props[i].type === NodeTypes.DIRECTIVE &&
        specialTemplateDir.has((props[i] as DirectiveNode).name)
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
    (currentOptions.isNativeTag && !currentOptions.isNativeTag(tag))
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
function condenseWhitespace(
  nodes: TemplateChildNode[],
  tag?: string
): TemplateChildNode[] {
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
  if (inPre && tag && currentOptions.isPreTag(tag)) {
    // remove leading newline per html spec
    // https://html.spec.whatwg.org/multipage/grouping-content.html#the-pre-element
    const first = nodes[0]
    if (first && first.type === NodeTypes.TEXT) {
      first.content = first.content.replace(/^\r?\n/, '')
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
  ;(stack[0] || currentRoot).children.push(node)
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
    name: dir.rawName!,
    nameLoc: getLoc(
      dir.loc.start.offset,
      dir.loc.start.offset + dir.rawName!.length
    ),
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
  currentAttrValue = ''
  currentAttrStartIndex = -1
  currentAttrEndIndex = -1
  stack.length = 0
}

export function baseParse(input: string, options?: ParserOptions): RootNode {
  reset()
  currentInput = input
  currentOptions = extend({}, defaultParserOptions, options)

  if (__DEV__) {
    if (!__BROWSER__ && currentOptions.decodeEntities) {
      console.warn(
        `[@vue/compiler-core] decodeEntities option is passed but will be ` +
          `ignored in non-browser builds.`
      )
    } else if (__BROWSER__ && !currentOptions.decodeEntities) {
      throw new Error(
        `[@vue/compiler-core] decodeEntities option is required in browser builds.`
      )
    }
  }

  tokenizer.mode =
    currentOptions.parseMode === 'html'
      ? ParseMode.HTML
      : currentOptions.parseMode === 'sfc'
      ? ParseMode.SFC
      : ParseMode.BASE

  const delimiters = options?.delimiters
  if (delimiters) {
    tokenizer.delimiterOpen = toCharCodes(delimiters[0])
    tokenizer.delimiterClose = toCharCodes(delimiters[1])
  }

  const root = (currentRoot = createRoot([], input))
  tokenizer.parse(currentInput)
  root.loc = getLoc(0, input.length)
  root.children = condenseWhitespace(root.children)
  currentRoot = null
  return root
}
