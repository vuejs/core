/**
 * This Tokenizer is adapted from htmlparser2 under the MIT License listed at
 * https://github.com/fb55/htmlparser2/blob/master/LICENSE

Copyright 2010, 2011, Chris Winberry <chris@winberry.net>. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
 */

import {
  EntityDecoder,
  DecodingMode,
  htmlDecodeTree
} from 'entities/lib/decode.js'
import { Position } from '../ast'

export const enum CharCodes {
  Tab = 0x9, // "\t"
  NewLine = 0xa, // "\n"
  FormFeed = 0xc, // "\f"
  CarriageReturn = 0xd, // "\r"
  Space = 0x20, // " "
  ExclamationMark = 0x21, // "!"
  Number = 0x23, // "#"
  Amp = 0x26, // "&"
  SingleQuote = 0x27, // "'"
  DoubleQuote = 0x22, // '"'
  Dash = 0x2d, // "-"
  Slash = 0x2f, // "/"
  Zero = 0x30, // "0"
  Nine = 0x39, // "9"
  Semi = 0x3b, // ";"
  Lt = 0x3c, // "<"
  Eq = 0x3d, // "="
  Gt = 0x3e, // ">"
  Questionmark = 0x3f, // "?"
  UpperA = 0x41, // "A"
  LowerA = 0x61, // "a"
  UpperF = 0x46, // "F"
  LowerF = 0x66, // "f"
  UpperZ = 0x5a, // "Z"
  LowerZ = 0x7a, // "z"
  LowerX = 0x78, // "x"
  OpeningSquareBracket = 0x5b, // "["
  LowerV = 0x76, // "v"
  Dot = 0x2e, // "."
  Colon = 0x3a, // ":"
  At = 0x40, // "@"
  LeftSqaure = 91, // "["
  RightSquare = 93 // "]"
}

/** All the states the tokenizer can be in. */
const enum State {
  Text = 1,
  BeforeTagName, // After <
  InTagName,
  InSelfClosingTag,
  BeforeClosingTagName,
  InClosingTagName,
  AfterClosingTagName,

  // Attributes
  BeforeAttributeName,
  InAttributeName,
  InDirectiveName,
  InDirectiveArg,
  InDirectiveDynamicArg,
  InDirectiveModifier,
  AfterAttributeName,
  BeforeAttributeValue,
  InAttributeValueDq, // "
  InAttributeValueSq, // '
  InAttributeValueNq,

  // Declarations
  BeforeDeclaration, // !
  InDeclaration,

  // Processing instructions
  InProcessingInstruction, // ?

  // Comments & CDATA
  BeforeComment,
  CDATASequence,
  InSpecialComment,
  InCommentLike,

  // Special tags
  BeforeSpecialS, // Decide if we deal with `<script` or `<style`
  SpecialStartSequence,
  InSpecialTag,

  InEntity
}

export function isWhitespace(c: number): boolean {
  return (
    c === CharCodes.Space ||
    c === CharCodes.NewLine ||
    c === CharCodes.Tab ||
    c === CharCodes.FormFeed ||
    c === CharCodes.CarriageReturn
  )
}

function isEndOfTagSection(c: number): boolean {
  return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c)
}

export enum QuoteType {
  NoValue = 0,
  Unquoted = 1,
  Single = 2,
  Double = 3
}

export interface Callbacks {
  ontext(start: number, endIndex: number): void
  ontextentity(codepoint: number, endIndex: number): void

  onopentagname(start: number, endIndex: number): void
  onopentagend(endIndex: number): void
  onselfclosingtag(endIndex: number): void
  onclosetag(start: number, endIndex: number): void

  onattribdata(start: number, endIndex: number): void
  onattribentity(codepoint: number): void
  onattribend(quote: QuoteType, endIndex: number): void
  onattribname(start: number, endIndex: number): void
  onattribnameend(endIndex: number): void

  ondirname(start: number, endIndex: number): void
  ondirarg(start: number, endIndex: number): void
  ondirmodifier(start: number, endIndex: number): void

  oncomment(start: number, endIndex: number, endOffset: number): void
  oncdata(start: number, endIndex: number, endOffset: number): void

  // onprocessinginstruction(start: number, endIndex: number): void
  // ondeclaration(start: number, endIndex: number): void
  onend(): void
}

/**
 * Sequences used to match longer strings.
 *
 * We don't have `Script`, `Style`, or `Title` here. Instead, we re-use the *End
 * sequences with an increased offset.
 */
const Sequences = {
  Cdata: new Uint8Array([0x43, 0x44, 0x41, 0x54, 0x41, 0x5b]), // CDATA[
  CdataEnd: new Uint8Array([0x5d, 0x5d, 0x3e]), // ]]>
  CommentEnd: new Uint8Array([0x2d, 0x2d, 0x3e]), // `-->`
  ScriptEnd: new Uint8Array([0x3c, 0x2f, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]), // `</script`
  StyleEnd: new Uint8Array([0x3c, 0x2f, 0x73, 0x74, 0x79, 0x6c, 0x65]), // `</style`
  TitleEnd: new Uint8Array([0x3c, 0x2f, 0x74, 0x69, 0x74, 0x6c, 0x65]) // `</title`
}

export default class Tokenizer {
  /** The current state the tokenizer is in. */
  private state = State.Text
  /** The read buffer. */
  private buffer = ''
  /** The beginning of the section that is currently being read. */
  private sectionStart = 0
  /** The index within the buffer that we are currently looking at. */
  private index = 0
  /** The start of the last entity. */
  private entityStart = 0
  /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */
  private baseState = State.Text
  /** For special parsing behavior inside of script and style tags. */
  private isSpecial = false
  /** Reocrd newline positions for fast line / column calculation */
  private newlines: number[] = []

  private readonly decodeEntities: boolean
  private readonly entityDecoder: EntityDecoder

  constructor(
    { decodeEntities = true }: { decodeEntities?: boolean },
    private readonly cbs: Callbacks
  ) {
    this.decodeEntities = decodeEntities
    this.entityDecoder = new EntityDecoder(htmlDecodeTree, (cp, consumed) =>
      this.emitCodePoint(cp, consumed)
    )
  }

  public reset(): void {
    this.state = State.Text
    this.buffer = ''
    this.sectionStart = 0
    this.index = 0
    this.baseState = State.Text
    this.currentSequence = undefined!
    this.newlines.length = 0
  }

  /**
   * Generate Position object with line / column information using recorded
   * newline positions. We know the index is always going to be an already
   * processed index, so all the newlines up to this index should have been
   * recorded.
   */
  public getPos(index: number): Position {
    let line = 1
    let column = index + 1
    for (let i = this.newlines.length - 1; i >= 0; i--) {
      const newlineIndex = this.newlines[i]
      if (index > newlineIndex) {
        line = i + 2
        column = index - newlineIndex
        break
      }
    }
    return {
      column,
      line,
      offset: index
    }
  }

  private stateText(c: number): void {
    if (
      c === CharCodes.Lt ||
      (!this.decodeEntities && this.fastForwardTo(CharCodes.Lt))
    ) {
      if (this.index > this.sectionStart) {
        this.cbs.ontext(this.sectionStart, this.index)
      }
      this.state = State.BeforeTagName
      this.sectionStart = this.index
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity()
    }
  }

  private currentSequence: Uint8Array = undefined!
  private sequenceIndex = 0
  private stateSpecialStartSequence(c: number): void {
    const isEnd = this.sequenceIndex === this.currentSequence.length
    const isMatch = isEnd
      ? // If we are at the end of the sequence, make sure the tag name has ended
        isEndOfTagSection(c)
      : // Otherwise, do a case-insensitive comparison
        (c | 0x20) === this.currentSequence[this.sequenceIndex]

    if (!isMatch) {
      this.isSpecial = false
    } else if (!isEnd) {
      this.sequenceIndex++
      return
    }

    this.sequenceIndex = 0
    this.state = State.InTagName
    this.stateInTagName(c)
  }

  /** Look for an end tag. For <title> tags, also decode entities. */
  private stateInSpecialTag(c: number): void {
    if (this.sequenceIndex === this.currentSequence.length) {
      if (c === CharCodes.Gt || isWhitespace(c)) {
        const endOfText = this.index - this.currentSequence.length

        if (this.sectionStart < endOfText) {
          // Spoof the index so that reported locations match up.
          const actualIndex = this.index
          this.index = endOfText
          this.cbs.ontext(this.sectionStart, endOfText)
          this.index = actualIndex
        }

        this.isSpecial = false
        this.sectionStart = endOfText + 2 // Skip over the `</`
        this.stateInClosingTagName(c)
        return // We are done; skip the rest of the function.
      }

      this.sequenceIndex = 0
    }

    if ((c | 0x20) === this.currentSequence[this.sequenceIndex]) {
      this.sequenceIndex += 1
    } else if (this.sequenceIndex === 0) {
      if (this.currentSequence === Sequences.TitleEnd) {
        // We have to parse entities in <title> tags.
        if (this.decodeEntities && c === CharCodes.Amp) {
          this.startEntity()
        }
      } else if (this.fastForwardTo(CharCodes.Lt)) {
        // Outside of <title> tags, we can fast-forward.
        this.sequenceIndex = 1
      }
    } else {
      // If we see a `<`, set the sequence index to 1; useful for eg. `<</script>`.
      this.sequenceIndex = Number(c === CharCodes.Lt)
    }
  }

  private stateCDATASequence(c: number): void {
    if (c === Sequences.Cdata[this.sequenceIndex]) {
      if (++this.sequenceIndex === Sequences.Cdata.length) {
        this.state = State.InCommentLike
        this.currentSequence = Sequences.CdataEnd
        this.sequenceIndex = 0
        this.sectionStart = this.index + 1
      }
    } else {
      this.sequenceIndex = 0
      this.state = State.InDeclaration
      this.stateInDeclaration(c) // Reconsume the character
    }
  }

  /**
   * When we wait for one specific character, we can speed things up
   * by skipping through the buffer until we find it.
   *
   * @returns Whether the character was found.
   */
  private fastForwardTo(c: number): boolean {
    while (++this.index < this.buffer.length) {
      if (this.buffer.charCodeAt(this.index) === c) {
        return true
      }
    }

    /*
     * We increment the index at the end of the `parse` loop,
     * so set it to `buffer.length - 1` here.
     *
     * TODO: Refactor `parse` to increment index before calling states.
     */
    this.index = this.buffer.length - 1

    return false
  }

  /**
   * Comments and CDATA end with `-->` and `]]>`.
   *
   * Their common qualities are:
   * - Their end sequences have a distinct character they start with.
   * - That character is then repeated, so we have to check multiple repeats.
   * - All characters but the start character of the sequence can be skipped.
   */
  private stateInCommentLike(c: number): void {
    if (c === this.currentSequence[this.sequenceIndex]) {
      if (++this.sequenceIndex === this.currentSequence.length) {
        if (this.currentSequence === Sequences.CdataEnd) {
          this.cbs.oncdata(this.sectionStart, this.index, 2)
        } else {
          this.cbs.oncomment(this.sectionStart, this.index, 2)
        }

        this.sequenceIndex = 0
        this.sectionStart = this.index + 1
        this.state = State.Text
      }
    } else if (this.sequenceIndex === 0) {
      // Fast-forward to the first character of the sequence
      if (this.fastForwardTo(this.currentSequence[0])) {
        this.sequenceIndex = 1
      }
    } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
      // Allow long sequences, eg. --->, ]]]>
      this.sequenceIndex = 0
    }
  }

  /**
   * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
   */
  private isTagStartChar(c: number) {
    return (
      (c >= CharCodes.LowerA && c <= CharCodes.LowerZ) ||
      (c >= CharCodes.UpperA && c <= CharCodes.UpperZ)
    )
  }

  private startSpecial(sequence: Uint8Array, offset: number) {
    this.isSpecial = true
    this.currentSequence = sequence
    this.sequenceIndex = offset
    this.state = State.SpecialStartSequence
  }

  private stateBeforeTagName(c: number): void {
    if (c === CharCodes.ExclamationMark) {
      this.state = State.BeforeDeclaration
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.Questionmark) {
      this.state = State.InProcessingInstruction
      this.sectionStart = this.index + 1
    } else if (this.isTagStartChar(c)) {
      const lower = c | 0x20
      this.sectionStart = this.index
      if (lower === Sequences.TitleEnd[2]) {
        this.startSpecial(Sequences.TitleEnd, 3)
      } else {
        this.state =
          lower === Sequences.ScriptEnd[2]
            ? State.BeforeSpecialS
            : State.InTagName
      }
    } else if (c === CharCodes.Slash) {
      this.state = State.BeforeClosingTagName
    } else {
      this.state = State.Text
      this.stateText(c)
    }
  }
  private stateInTagName(c: number): void {
    if (isEndOfTagSection(c)) {
      this.cbs.onopentagname(this.sectionStart, this.index)
      this.sectionStart = -1
      this.state = State.BeforeAttributeName
      this.stateBeforeAttributeName(c)
    }
  }
  private stateBeforeClosingTagName(c: number): void {
    if (isWhitespace(c)) {
      // Ignore
    } else if (c === CharCodes.Gt) {
      this.state = State.Text
    } else {
      this.state = this.isTagStartChar(c)
        ? State.InClosingTagName
        : State.InSpecialComment
      this.sectionStart = this.index
    }
  }
  private stateInClosingTagName(c: number): void {
    if (c === CharCodes.Gt || isWhitespace(c)) {
      this.cbs.onclosetag(this.sectionStart, this.index)
      this.sectionStart = -1
      this.state = State.AfterClosingTagName
      this.stateAfterClosingTagName(c)
    }
  }
  private stateAfterClosingTagName(c: number): void {
    // Skip everything until ">"
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  private stateBeforeAttributeName(c: number): void {
    if (c === CharCodes.Gt) {
      this.cbs.onopentagend(this.index)
      if (this.isSpecial) {
        this.state = State.InSpecialTag
        this.sequenceIndex = 0
      } else {
        this.state = State.Text
      }
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.Slash) {
      this.state = State.InSelfClosingTag
    } else if (!isWhitespace(c)) {
      this.handleAttributeStart(c)
    }
  }
  private handleAttributeStart(c: number) {
    if (
      c === CharCodes.LowerV &&
      this.buffer.charCodeAt(this.index + 1) === CharCodes.Dash
    ) {
      this.state = State.InDirectiveName
      this.sectionStart = this.index
    } else if (
      c === CharCodes.Dot ||
      c === CharCodes.Colon ||
      c === CharCodes.At ||
      c === CharCodes.Number
    ) {
      this.cbs.ondirname(this.index, this.index + 1)
      this.state = State.InDirectiveArg
      this.sectionStart = this.index + 1
    } else {
      this.state = State.InAttributeName
      this.sectionStart = this.index
    }
  }
  private stateInSelfClosingTag(c: number): void {
    if (c === CharCodes.Gt) {
      this.cbs.onselfclosingtag(this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
      this.isSpecial = false // Reset special state, in case of self-closing special tags
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttributeName
      this.stateBeforeAttributeName(c)
    }
  }
  private stateInAttributeName(c: number): void {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.onattribname(this.sectionStart, this.index)
      this.handleAttributeNameEnd(c)
    }
  }
  private stateInDirectiveName(c: number): void {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.ondirname(this.sectionStart, this.index)
      this.handleAttributeNameEnd(c)
    } else if (c === CharCodes.Colon) {
      this.cbs.ondirname(this.sectionStart, this.index)
      this.state = State.InDirectiveArg
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.Dot) {
      this.cbs.ondirname(this.sectionStart, this.index)
      this.state = State.InDirectiveModifier
      this.sectionStart = this.index + 1
    }
  }
  private stateInDirectiveArg(c: number): void {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.ondirarg(this.sectionStart, this.index)
      this.handleAttributeNameEnd(c)
    } else if (c === CharCodes.LeftSqaure) {
      this.state = State.InDirectiveDynamicArg
    } else if (c === CharCodes.Dot) {
      this.cbs.ondirarg(this.sectionStart, this.index)
      this.state = State.InDirectiveModifier
      this.sectionStart = this.index + 1
    }
  }
  private stateInDynamicDirectiveArg(c: number): void {
    if (c === CharCodes.RightSquare) {
      this.state = State.InDirectiveArg
    } else if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      // TODO emit error
    }
  }
  private stateInDirectiveModifier(c: number): void {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.ondirmodifier(this.sectionStart, this.index)
      this.handleAttributeNameEnd(c)
    } else if (c === CharCodes.Dot) {
      this.cbs.ondirmodifier(this.sectionStart, this.index)
      this.sectionStart = this.index + 1
    }
  }
  private handleAttributeNameEnd(c: number): void {
    this.sectionStart = this.index
    this.state = State.AfterAttributeName
    this.cbs.onattribnameend(this.index)
    this.stateAfterAttributeName(c)
  }
  private stateAfterAttributeName(c: number): void {
    if (c === CharCodes.Eq) {
      this.state = State.BeforeAttributeValue
    } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart)
      this.sectionStart = -1
      this.state = State.BeforeAttributeName
      this.stateBeforeAttributeName(c)
    } else if (!isWhitespace(c)) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart)
      this.handleAttributeStart(c)
    }
  }
  private stateBeforeAttributeValue(c: number): void {
    if (c === CharCodes.DoubleQuote) {
      this.state = State.InAttributeValueDq
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.SingleQuote) {
      this.state = State.InAttributeValueSq
      this.sectionStart = this.index + 1
    } else if (!isWhitespace(c)) {
      this.sectionStart = this.index
      this.state = State.InAttributeValueNq
      this.stateInAttributeValueNoQuotes(c) // Reconsume token
    }
  }
  private handleInAttributeValue(c: number, quote: number) {
    if (c === quote || (!this.decodeEntities && this.fastForwardTo(quote))) {
      this.cbs.onattribdata(this.sectionStart, this.index)
      this.sectionStart = -1
      this.cbs.onattribend(
        quote === CharCodes.DoubleQuote ? QuoteType.Double : QuoteType.Single,
        this.index + 1
      )
      this.state = State.BeforeAttributeName
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity()
    }
  }
  private stateInAttributeValueDoubleQuotes(c: number): void {
    this.handleInAttributeValue(c, CharCodes.DoubleQuote)
  }
  private stateInAttributeValueSingleQuotes(c: number): void {
    this.handleInAttributeValue(c, CharCodes.SingleQuote)
  }
  private stateInAttributeValueNoQuotes(c: number): void {
    if (isWhitespace(c) || c === CharCodes.Gt) {
      this.cbs.onattribdata(this.sectionStart, this.index)
      this.sectionStart = -1
      this.cbs.onattribend(QuoteType.Unquoted, this.index)
      this.state = State.BeforeAttributeName
      this.stateBeforeAttributeName(c)
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity()
    }
  }
  private stateBeforeDeclaration(c: number): void {
    if (c === CharCodes.OpeningSquareBracket) {
      this.state = State.CDATASequence
      this.sequenceIndex = 0
    } else {
      this.state =
        c === CharCodes.Dash ? State.BeforeComment : State.InDeclaration
    }
  }
  private stateInDeclaration(c: number): void {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      // this.cbs.ondeclaration(this.sectionStart, this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  private stateInProcessingInstruction(c: number): void {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      // this.cbs.onprocessinginstruction(this.sectionStart, this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  private stateBeforeComment(c: number): void {
    if (c === CharCodes.Dash) {
      this.state = State.InCommentLike
      this.currentSequence = Sequences.CommentEnd
      // Allow short comments (eg. <!-->)
      this.sequenceIndex = 2
      this.sectionStart = this.index + 1
    } else {
      this.state = State.InDeclaration
    }
  }
  private stateInSpecialComment(c: number): void {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.cbs.oncomment(this.sectionStart, this.index, 0)
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  private stateBeforeSpecialS(c: number): void {
    const lower = c | 0x20
    if (lower === Sequences.ScriptEnd[3]) {
      this.startSpecial(Sequences.ScriptEnd, 4)
    } else if (lower === Sequences.StyleEnd[3]) {
      this.startSpecial(Sequences.StyleEnd, 4)
    } else {
      this.state = State.InTagName
      this.stateInTagName(c) // Consume the token again
    }
  }

  private startEntity() {
    this.baseState = this.state
    this.state = State.InEntity
    this.entityStart = this.index
    this.entityDecoder.startEntity(
      this.baseState === State.Text || this.baseState === State.InSpecialTag
        ? DecodingMode.Legacy
        : DecodingMode.Attribute
    )
  }

  private stateInEntity(): void {
    const length = this.entityDecoder.write(this.buffer, this.index)

    // If `length` is positive, we are done with the entity.
    if (length >= 0) {
      this.state = this.baseState

      if (length === 0) {
        this.index = this.entityStart
      }
    } else {
      // Mark buffer as consumed.
      this.index = this.buffer.length - 1
    }
  }

  /**
   * Iterates through the buffer, calling the function corresponding to the current state.
   *
   * States that are more likely to be hit are higher up, as a performance improvement.
   */
  public parse(input: string) {
    this.buffer = input
    while (this.index < this.buffer.length) {
      const c = this.buffer.charCodeAt(this.index)
      switch (this.state) {
        case State.Text: {
          this.stateText(c)
          break
        }
        case State.SpecialStartSequence: {
          this.stateSpecialStartSequence(c)
          break
        }
        case State.InSpecialTag: {
          this.stateInSpecialTag(c)
          break
        }
        case State.CDATASequence: {
          this.stateCDATASequence(c)
          break
        }
        case State.InAttributeValueDq: {
          this.stateInAttributeValueDoubleQuotes(c)
          break
        }
        case State.InAttributeName: {
          this.stateInAttributeName(c)
          break
        }
        case State.InDirectiveName: {
          this.stateInDirectiveName(c)
          break
        }
        case State.InDirectiveArg: {
          this.stateInDirectiveArg(c)
          break
        }
        case State.InDirectiveDynamicArg: {
          this.stateInDynamicDirectiveArg(c)
          break
        }
        case State.InDirectiveModifier: {
          this.stateInDirectiveModifier(c)
          break
        }
        case State.InCommentLike: {
          this.stateInCommentLike(c)
          break
        }
        case State.InSpecialComment: {
          this.stateInSpecialComment(c)
          break
        }
        case State.BeforeAttributeName: {
          this.stateBeforeAttributeName(c)
          break
        }
        case State.InTagName: {
          this.stateInTagName(c)
          break
        }
        case State.InClosingTagName: {
          this.stateInClosingTagName(c)
          break
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(c)
          break
        }
        case State.AfterAttributeName: {
          this.stateAfterAttributeName(c)
          break
        }
        case State.InAttributeValueSq: {
          this.stateInAttributeValueSingleQuotes(c)
          break
        }
        case State.BeforeAttributeValue: {
          this.stateBeforeAttributeValue(c)
          break
        }
        case State.BeforeClosingTagName: {
          this.stateBeforeClosingTagName(c)
          break
        }
        case State.AfterClosingTagName: {
          this.stateAfterClosingTagName(c)
          break
        }
        case State.BeforeSpecialS: {
          this.stateBeforeSpecialS(c)
          break
        }
        case State.InAttributeValueNq: {
          this.stateInAttributeValueNoQuotes(c)
          break
        }
        case State.InSelfClosingTag: {
          this.stateInSelfClosingTag(c)
          break
        }
        case State.InDeclaration: {
          this.stateInDeclaration(c)
          break
        }
        case State.BeforeDeclaration: {
          this.stateBeforeDeclaration(c)
          break
        }
        case State.BeforeComment: {
          this.stateBeforeComment(c)
          break
        }
        case State.InProcessingInstruction: {
          this.stateInProcessingInstruction(c)
          break
        }
        case State.InEntity: {
          this.stateInEntity()
          break
        }
      }
      if (c === CharCodes.NewLine) {
        this.newlines.push(this.index)
      }
      this.index++
    }
    this.cleanup()
    this.finish()
  }

  /**
   * Remove data that has already been consumed from the buffer.
   */
  private cleanup() {
    // If we are inside of text or attributes, emit what we already have.
    if (this.sectionStart !== this.index) {
      if (
        this.state === State.Text ||
        (this.state === State.InSpecialTag && this.sequenceIndex === 0)
      ) {
        this.cbs.ontext(this.sectionStart, this.index)
        this.sectionStart = this.index
      } else if (
        this.state === State.InAttributeValueDq ||
        this.state === State.InAttributeValueSq ||
        this.state === State.InAttributeValueNq
      ) {
        this.cbs.onattribdata(this.sectionStart, this.index)
        this.sectionStart = this.index
      }
    }
  }

  private finish() {
    if (this.state === State.InEntity) {
      this.entityDecoder.end()
      this.state = this.baseState
    }

    this.handleTrailingData()

    this.cbs.onend()
  }

  /** Handle any trailing data. */
  private handleTrailingData() {
    const endIndex = this.buffer.length

    // If there is no remaining data, we are done.
    if (this.sectionStart >= endIndex) {
      return
    }

    if (this.state === State.InCommentLike) {
      if (this.currentSequence === Sequences.CdataEnd) {
        this.cbs.oncdata(this.sectionStart, endIndex, 0)
      } else {
        this.cbs.oncomment(this.sectionStart, endIndex, 0)
      }
    } else if (
      this.state === State.InTagName ||
      this.state === State.BeforeAttributeName ||
      this.state === State.BeforeAttributeValue ||
      this.state === State.AfterAttributeName ||
      this.state === State.InAttributeName ||
      this.state === State.InDirectiveName ||
      this.state === State.InDirectiveArg ||
      this.state === State.InDirectiveDynamicArg ||
      this.state === State.InDirectiveModifier ||
      this.state === State.InAttributeValueSq ||
      this.state === State.InAttributeValueDq ||
      this.state === State.InAttributeValueNq ||
      this.state === State.InClosingTagName
    ) {
      /*
       * If we are currently in an opening or closing tag, us not calling the
       * respective callback signals that the tag should be ignored.
       */
    } else {
      this.cbs.ontext(this.sectionStart, endIndex)
    }
  }

  private emitCodePoint(cp: number, consumed: number): void {
    if (
      this.baseState !== State.Text &&
      this.baseState !== State.InSpecialTag
    ) {
      if (this.sectionStart < this.entityStart) {
        this.cbs.onattribdata(this.sectionStart, this.entityStart)
      }
      this.sectionStart = this.entityStart + consumed
      this.index = this.sectionStart - 1

      this.cbs.onattribentity(cp)
    } else {
      if (this.sectionStart < this.entityStart) {
        this.cbs.ontext(this.sectionStart, this.entityStart)
      }
      this.sectionStart = this.entityStart + consumed
      this.index = this.sectionStart - 1

      this.cbs.ontextentity(cp, this.sectionStart)
    }
  }
}
