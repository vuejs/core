import Tokenizer, { Callbacks, QuoteType } from './Tokenizer.js'
import { fromCodePoint } from 'entities/lib/decode.js'

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

export interface ParserOptions {
  /**
   * Decode entities within the document.
   *
   * @default true
   */
  decodeEntities?: boolean
}

export interface Handler {
  onparserinit(parser: Parser): void

  /**
   * Resets the handler back to starting state
   */
  onreset(): void

  /**
   * Signals the handler that parsing is done
   */
  onend(): void
  onerror(error: Error): void
  onclosetag(name: string, isImplied: boolean): void
  onopentagname(name: string): void
  /**
   *
   * @param name Name of the attribute
   * @param value Value of the attribute.
   * @param quote Quotes used around the attribute. `null` if the attribute has no quotes around the value, `undefined` if the attribute has no value.
   */
  onattribute(
    name: string,
    value: string,
    quote?: string | undefined | null
  ): void
  onopentag(
    name: string,
    attribs: { [s: string]: string },
    isImplied: boolean
  ): void
  ontext(data: string): void
  oncomment(data: string): void
  oncdatastart(): void
  oncdataend(): void
  oncommentend(): void
  onprocessinginstruction(name: string, data: string): void
}

const reNameEnd = /\s|\//

export class Parser implements Callbacks {
  /** The start index of the last event. */
  public startIndex = 0
  /** The end index of the last event. */
  public endIndex = 0
  /**
   * Store the start index of the current open tag,
   * so we can update the start index for attributes.
   */
  private openTagStart = 0

  private tagname = ''
  private attribname = ''
  private attribvalue = ''
  private attribs: null | { [key: string]: string } = null
  private readonly stack: string[] = []
  /** Determines whether self-closing tags are recognized. */
  private readonly foreignContext: boolean[]
  private readonly cbs: Partial<Handler>
  private readonly tokenizer: Tokenizer

  private buffer: string = ''

  constructor(
    cbs?: Partial<Handler> | null,
    private readonly options: ParserOptions = {}
  ) {
    this.cbs = cbs ?? {}
    this.tokenizer = new Tokenizer(this.options, this)
    this.foreignContext = [false]
    this.cbs.onparserinit?.(this)
  }

  // Tokenizer event handlers

  /** @internal */
  ontext(start: number, endIndex: number): void {
    const data = this.getSlice(start, endIndex)
    this.endIndex = endIndex - 1
    this.cbs.ontext?.(data)
    this.startIndex = endIndex
  }

  /** @internal */
  ontextentity(cp: number, endIndex: number): void {
    this.endIndex = endIndex - 1
    this.cbs.ontext?.(fromCodePoint(cp))
    this.startIndex = endIndex
  }

  /** @internal */
  onopentagname(start: number, endIndex: number): void {
    this.emitOpenTag(this.getSlice(start, (this.endIndex = endIndex)))
  }

  private emitOpenTag(name: string) {
    this.openTagStart = this.startIndex
    this.tagname = name

    const impliesClose = openImpliesClose.get(name)

    if (impliesClose) {
      while (this.stack.length > 0 && impliesClose.has(this.stack[0])) {
        const element = this.stack.shift()!
        this.cbs.onclosetag?.(element, true)
      }
    }
    if (!voidElements.has(name)) {
      this.stack.unshift(name)

      if (foreignContextElements.has(name)) {
        this.foreignContext.unshift(true)
      } else if (htmlIntegrationElements.has(name)) {
        this.foreignContext.unshift(false)
      }
    }
    this.cbs.onopentagname?.(name)
    if (this.cbs.onopentag) this.attribs = {}
  }

  private endOpenTag(isImplied: boolean) {
    this.startIndex = this.openTagStart

    if (this.attribs) {
      this.cbs.onopentag?.(this.tagname, this.attribs, isImplied)
      this.attribs = null
    }
    if (this.cbs.onclosetag && voidElements.has(this.tagname)) {
      this.cbs.onclosetag(this.tagname, true)
    }

    this.tagname = ''
  }

  /** @internal */
  onopentagend(endIndex: number): void {
    this.endIndex = endIndex
    this.endOpenTag(false)

    // Set `startIndex` for next node
    this.startIndex = endIndex + 1
  }

  /** @internal */
  onclosetag(start: number, endIndex: number): void {
    const name = this.getSlice(start, (this.endIndex = endIndex))

    if (foreignContextElements.has(name) || htmlIntegrationElements.has(name)) {
      this.foreignContext.shift()
    }

    if (!voidElements.has(name)) {
      const pos = this.stack.indexOf(name)
      if (pos !== -1) {
        for (let index = 0; index <= pos; index++) {
          const element = this.stack.shift()!
          // We know the stack has sufficient elements.
          this.cbs.onclosetag?.(element, index !== pos)
        }
      } else if (name === 'p') {
        // Implicit open before close
        this.emitOpenTag('p')
        this.closeCurrentTag(true)
      }
    } else if (name === 'br') {
      // We can't use `emitOpenTag` for implicit open, as `br` would be implicitly closed.
      this.cbs.onopentagname?.('br')
      this.cbs.onopentag?.('br', {}, true)
      this.cbs.onclosetag?.('br', false)
    }

    // Set `startIndex` for next node
    this.startIndex = endIndex + 1
  }

  /** @internal */
  onselfclosingtag(endIndex: number): void {
    this.endIndex = endIndex
    this.closeCurrentTag(false)
    // Set `startIndex` for next node
    this.startIndex = endIndex + 1
  }

  private closeCurrentTag(isOpenImplied: boolean) {
    const name = this.tagname
    this.endOpenTag(isOpenImplied)

    // Self-closing tags will be on the top of the stack
    if (this.stack[0] === name) {
      // If the opening tag isn't implied, the closing tag has to be implied.
      this.cbs.onclosetag?.(name, !isOpenImplied)
      this.stack.shift()
    }
  }

  /** @internal */
  onattribname(start: number, endIndex: number): void {
    this.attribname = this.getSlice((this.startIndex = start), endIndex)
  }

  /** @internal */
  onattribdata(start: number, endIndex: number): void {
    this.attribvalue += this.getSlice(start, endIndex)
  }

  /** @internal */
  onattribentity(cp: number): void {
    this.attribvalue += fromCodePoint(cp)
  }

  /** @internal */
  onattribend(quote: QuoteType, endIndex: number): void {
    this.endIndex = endIndex

    this.cbs.onattribute?.(
      this.attribname,
      this.attribvalue,
      quote === QuoteType.Double
        ? '"'
        : quote === QuoteType.Single
        ? "'"
        : quote === QuoteType.NoValue
        ? undefined
        : null
    )

    if (
      this.attribs &&
      !Object.prototype.hasOwnProperty.call(this.attribs, this.attribname)
    ) {
      this.attribs[this.attribname] = this.attribvalue
    }
    this.attribvalue = ''
  }

  private getInstructionName(value: string) {
    const index = value.search(reNameEnd)
    return index < 0 ? value : value.slice(0, index)
  }

  /** @internal */
  ondeclaration(start: number, endIndex: number): void {
    this.endIndex = endIndex
    const value = this.getSlice(start, endIndex)

    if (this.cbs.onprocessinginstruction) {
      const name = this.getInstructionName(value)
      this.cbs.onprocessinginstruction(`!${name}`, `!${value}`)
    }

    // Set `startIndex` for next node
    this.startIndex = endIndex + 1
  }

  /** @internal */
  onprocessinginstruction(start: number, endIndex: number): void {
    this.endIndex = endIndex
    const value = this.getSlice(start, endIndex)

    if (this.cbs.onprocessinginstruction) {
      const name = this.getInstructionName(value)
      this.cbs.onprocessinginstruction(`?${name}`, `?${value}`)
    }

    // Set `startIndex` for next node
    this.startIndex = endIndex + 1
  }

  /** @internal */
  oncomment(start: number, endIndex: number, offset: number): void {
    this.endIndex = endIndex

    this.cbs.oncomment?.(this.getSlice(start, endIndex - offset))
    this.cbs.oncommentend?.()

    // Set `startIndex` for next node
    this.startIndex = endIndex + 1
  }

  /** @internal */
  oncdata(start: number, endIndex: number, offset: number): void {
    this.endIndex = endIndex
    this.cbs.oncdatastart?.()
    this.cbs.ontext?.(this.getSlice(start, endIndex - offset))
    this.cbs.oncdataend?.()
    // Set `startIndex` for next node
    this.startIndex = endIndex + 1
  }

  /** @internal */
  onend(): void {
    if (this.cbs.onclosetag) {
      // Set the end index for all remaining tags
      this.endIndex = this.startIndex
      for (let index = 0; index < this.stack.length; index++) {
        this.cbs.onclosetag(this.stack[index], true)
      }
    }
    this.cbs.onend?.()
  }

  private getSlice(start: number, end: number) {
    return this.buffer.slice(start, end)
  }

  /**
   * Parses a chunk of data and calls the corresponding callbacks.
   *
   * @param input string to parse.
   */
  public parse(input: string): void {
    this.reset()
    this.buffer = input
    this.tokenizer.parse(input)
  }

  /**
   * Resets the parser to a blank state, ready to parse a new HTML document
   */
  public reset(): void {
    this.cbs.onreset?.()
    this.tokenizer.reset()
    this.tagname = ''
    this.attribname = ''
    this.attribs = null
    this.stack.length = 0
    this.startIndex = 0
    this.endIndex = 0
    this.cbs.onparserinit?.(this)
    this.foreignContext.length = 0
    this.foreignContext.unshift(false)
  }
}
