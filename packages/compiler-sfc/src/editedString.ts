import {
  type Piece,
  type SourceRewrite,
  createSourceRewrite,
  renderWithDecodedSourceMap,
  renderWithSourceMap,
  rewritePieceText,
} from 'muggle-string'

export type ExclusionRange = [number, number]

export interface EditedStringOptions {
  filename?: string
  indentExclusionRanges?: ExclusionRange | Array<ExclusionRange>
  offset?: number
}

export interface IndentOptions {
  exclude?: ExclusionRange | Array<ExclusionRange>
  indentStart?: boolean
}

export interface OverwriteOptions {
  storeName?: boolean
  contentOnly?: boolean
}

export interface UpdateOptions {
  storeName?: boolean
  overwrite?: boolean
}

export interface SourceMapOptions {
  /**
   * `true` and `'boundary'` map the start of every token, line and piece of
   * the output; `false` (the default) maps the start of every line and piece,
   * and the positions passed to `addSourcemapLocation`.
   */
  hires?: boolean | 'boundary'
  /** The file the map is written for; `file` is its basename. */
  file?: string
  /** The file of the original, relative to `file` in `sources`. */
  source?: string
  /** Whether `sourcesContent` holds the original. */
  includeContent?: boolean
}

export type SourceMapSegment =
  | [number]
  | [number, number, number, number]
  | [number, number, number, number, number]

export interface DecodedSourceMap {
  file: string
  sources: string[]
  sourcesContent?: string[]
  names: string[]
  mappings: SourceMapSegment[][]
  x_google_ignoreList?: number[]
}

export class SourceMap {
  version: number
  file: string
  sources: string[]
  sourcesContent?: string[]
  names: string[]
  mappings: string
  x_google_ignoreList?: number[]
  debugId?: string

  constructor(
    properties: Omit<DecodedSourceMap, 'mappings'> & { mappings: string },
  ) {
    this.version = 3
    this.file = properties.file
    this.sources = properties.sources
    this.sourcesContent = properties.sourcesContent
    this.names = properties.names
    this.mappings = properties.mappings
    if (properties.x_google_ignoreList !== undefined) {
      this.x_google_ignoreList = properties.x_google_ignoreList
    }
  }

  /** The map as JSON. */
  toString(): string {
    return JSON.stringify(this)
  }

  /** The map as a base64 data URL. */
  toUrl(): string {
    return `data:application/json;charset=utf-8;base64,${base64(this.toString())}`
  }
}

function base64(text: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(text, 'utf-8').toString('base64')
  }
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + 0x8000) as unknown as number[],
    )
  }
  return btoa(binary)
}

interface Src {
  readonly content: string
}
interface Named {
  name?: string
}
type Sink = (piece: Piece<Named & { source: Src }>) => void

/**
 * An edited range of the original. With `seg`, a replacement whose content
 * renders at `start`, the rest of the range rendering nothing; without, a
 * removal. `name` is the original the replacement renames, with `storeName`.
 */
interface Edit {
  start: number
  end: number
  content: string
  seg: boolean
  name: string | undefined
}

type Kind = 'gi' | 'go' | 'in' | 'out' | 'rep'
/** A piece of the output: kept original, or text of the state at `at`. */
type OutputPiece =
  | { k?: undefined; start: number; end: number }
  | { k: Kind; at: number; text: string }

/** The first index in sorted `a` whose value is greater than `x`. */
function upper(a: number[], x: number): number {
  let lo = 0
  let hi = a.length
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (a[m] <= x) lo = m + 1
    else hi = m
  }
  return lo
}

function relativePath(from: string, to: string): string {
  const dir = from.split(/[/\\]/)
  dir.pop()
  const target = to.split(/[/\\]/)
  let i = 0
  while (i < dir.length && i < target.length && dir[i] === target[i]) i++
  return dir
    .slice(i)
    .map(() => '..')
    .concat(target.slice(i))
    .join('/')
}

function guessIndent(code: string): string | null {
  let tabbed = 0
  let spaced = 0
  let min = Infinity
  for (const line of code.split('\n')) {
    if (line[0] === '\t') {
      tabbed++
    } else if (line.startsWith('  ')) {
      spaced++
      min = Math.min(min, line.length - line.replace(/^ +/, '').length)
    }
  }
  if (!tabbed && !spaced) return null
  return tabbed >= spaced ? '\t' : ' '.repeat(min)
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function excludedChars(
  exclude: ExclusionRange | Array<ExclusionRange> | undefined,
): Set<number> {
  const chars = new Set<number>()
  if (!exclude) return chars
  const ranges = (
    typeof exclude[0] === 'number' ? [exclude] : exclude
  ) as ExclusionRange[]
  for (const [start, end] of ranges) {
    for (let i = start; i < end; i++) chars.add(i)
  }
  return chars
}

/**
 * `sink` for the maps of `hires` false: kept text goes as ranges with their
 * own text, from each line start and each of sorted `locs`, so that each maps
 * only at its start; line ends stay kept text, which maps nothing.
 */
function coarse(sink: Sink, locs: number[]): Sink {
  return piece => {
    if (typeof piece === 'string' || piece.text !== undefined) {
      return sink(piece)
    }
    const { content } = piece.source
    let k = upper(locs, piece.start)
    for (let a = piece.start; a < piece.end;) {
      if (content.charCodeAt(a) === 10) {
        sink({ ...piece, start: a, end: a + 1 })
        a++
        continue
      }
      while (k < locs.length && locs[k] <= a) k++
      const nl = content.indexOf('\n', a)
      const lineEnd = nl < 0 || nl > piece.end ? piece.end : nl
      const b = k < locs.length && locs[k] < lineEnd ? locs[k] : lineEnd
      sink({ ...piece, start: a, end: b, text: content.slice(a, b) })
      a = b
    }
  }
}

/**
 * A string with edits at offsets of its original: inserts, replacements,
 * removals and moves. muggle-string renders its text and source maps from a
 * rewrite of the edits.
 */
export class EditedString {
  declare original: string
  declare offset: number
  declare indentExclusionRanges: ExclusionRange | Array<ExclusionRange>
  /** @internal */
  declare filename: string | undefined
  /** @internal */
  declare ignoreList: boolean | undefined
  /** @internal */
  declare indentStr: string | null | undefined
  /** @internal text before all of the output */
  declare _gi: string
  /** @internal text after all of the output */
  declare _go: string
  /** @internal the output, until the next edit */
  declare _str: string | null
  /** @internal the rewrite of the edits, until the next edit */
  declare _rw: SourceRewrite<Src, Named> | null
  /** @internal chunks in output order as flat [start, end, ...], until a split or move */
  declare _ord: number[] | null
  /** @internal the original, as the source of the rewrites */
  declare _src: Src
  /** @internal inserts before the char at an offset; they move with it */
  declare _introAt: Map<number, string>
  /** @internal inserts after the char before an offset; they move with it */
  declare _outroAt: Map<number, string>
  /** @internal sorted, disjoint */
  declare _edits: Edit[]
  /** @internal after a move, the output order as runs of the original, flat [start, end, ...] */
  declare _runs: number[] | null
  /** @internal chunk boundaries strictly inside the original, sorted */
  declare _bnd: number[]
  /** @internal */
  declare _locs: Set<number>

  constructor(string: string, options: EditedStringOptions = {}) {
    Object.defineProperties(this, {
      original: { writable: true, value: string },
      offset: { writable: true, value: options.offset || 0 },
      indentExclusionRanges: {
        writable: true,
        value: options.indentExclusionRanges,
      },
      filename: { writable: true, value: options.filename },
      ignoreList: {
        writable: true,
        value: (options as { ignoreList?: boolean }).ignoreList,
      },
      indentStr: { writable: true, value: undefined },
      _gi: { writable: true, value: '' },
      _go: { writable: true, value: '' },
      _str: { writable: true, value: null },
      _rw: { writable: true, value: null },
      _ord: { writable: true, value: null },
      _src: { writable: true, value: { content: string } },
      _introAt: { writable: true, value: new Map() },
      _outroAt: { writable: true, value: new Map() },
      _edits: { writable: true, value: [] },
      _runs: { writable: true, value: null },
      _bnd: { writable: true, value: [] },
      _locs: { writable: true, value: new Set() },
    })
  }

  /** @internal */
  get intro(): string {
    return this._gi
  }
  /** @internal */
  set intro(text: string) {
    this._gi = text
    this._changed()
  }
  /** @internal */
  get outro(): string {
    return this._go
  }
  /** @internal */
  set outro(text: string) {
    this._go = text
    this._changed()
  }

  /** @internal */
  _changed(): void {
    this._str = null
    this._rw = null
  }

  /** @internal */
  _offsetIndex(index: number): number {
    const resolved = index + this.offset
    if (!Number.isInteger(resolved)) {
      throw new TypeError(`index must be an integer, got ${index}`)
    }
    return resolved
  }

  /** @internal An offset index, negatives counting from the end. */
  _rangeIndex(index: number): number {
    const resolved = this._offsetIndex(index)
    const len = this.original.length
    return resolved < 0 && len !== 0 ? ((resolved % len) + len) % len : resolved
  }

  /** @internal */
  _isBound(index: number): boolean {
    if (index <= 0 || index >= this.original.length) return true
    const i = upper(this._bnd, index) - 1
    return i >= 0 && this._bnd[i] === index
  }

  /** @internal */
  _addBound(index: number): void {
    if (this._isBound(index)) return
    this._bnd.splice(upper(this._bnd, index), 0, index)
    this._ord = null
  }

  /** @internal The end of the chunk that starts at `start`. */
  _chunkEnd(start: number): number {
    const i = upper(this._bnd, start)
    return i < this._bnd.length ? this._bnd[i] : this.original.length
  }

  /** @internal The index of the first edit that ends after `i`. */
  _editFrom(i: number): number {
    const edits = this._edits
    let lo = 0
    let hi = edits.length
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (edits[m].end <= i) lo = m + 1
      else hi = m
    }
    return lo
  }

  /** @internal The edit holding char `i`. */
  _editAt(i: number): Edit | undefined {
    const edit = this._edits[this._editFrom(i)]
    return edit && edit.start <= i ? edit : undefined
  }

  /**
   * @internal Clears `start`..`end` of edits, the rest of a cut replacement
   * staying removed; returns the index an edit of the range goes at.
   */
  _carve(start: number, end: number): number {
    const edits = this._edits
    const a = this._editFrom(start)
    let b = a
    const keep: Edit[] = []
    while (b < edits.length && edits[b].start < end) {
      const edit = edits[b]
      if (edit.start < start) keep.push({ ...edit, end: start })
      if (edit.end > end) {
        keep.push({ ...edit, start: end, seg: false, content: '' })
      }
      b++
    }
    edits.splice(a, b - a, ...keep)
    return a + (keep.length && keep[0].start < start ? 1 : 0)
  }

  /** @internal A chunk boundary at `index`, which a replacement's first chunk cannot take. */
  _split(index: number): void {
    if (this._isBound(index)) return
    const edit = this._editAt(index)
    if (edit && edit.seg && edit.start < index && edit.content.length) {
      const firstEnd = this._chunkEnd(edit.start)
      if (index < firstEnd) {
        const before = this.original.slice(0, index)
        const line = before.split('\n').length - 1
        const column = index - before.lastIndexOf('\n') - 1
        throw new Error(
          `Cannot split a chunk that has already been edited (${line}:${column} – "${this.original.slice(edit.start, firstEnd)}")`,
        )
      }
    }
    this._addBound(index)
  }

  /** @internal */
  _addIntro(at: number, content: string, prepend: boolean): void {
    const old = this._introAt.get(at) || ''
    this._introAt.set(at, prepend ? content + old : old + content)
  }

  /** @internal */
  _addOutro(at: number, content: string, prepend: boolean): void {
    const old = this._outroAt.get(at) || ''
    this._outroAt.set(at, prepend ? content + old : old + content)
  }

  /** @internal Deletes intros at [iFrom, iTo) and outros at (oFrom, oTo]. */
  _clearInserts(iFrom: number, iTo: number, oFrom: number, oTo: number): void {
    const clear = (map: Map<number, string>, a: number, b: number) => {
      if (b - a <= map.size) {
        for (let k = a; k < b; k++) map.delete(k)
      } else {
        map.forEach((_, k) => {
          if (k >= a && k < b) map.delete(k)
        })
      }
    }
    clear(this._introAt, iFrom, iTo)
    clear(this._outroAt, oFrom + 1, oTo + 1)
  }

  /** @internal */
  _markRemoved(start: number, end: number): void {
    if (start >= end) return
    const at = this._carve(start, end)
    this._edits.splice(at, 0, {
      start,
      end,
      content: '',
      seg: false,
      name: undefined,
    })
  }

  /**
   * @internal Walks the chunks in output order (one empty chunk for an empty
   * original), with the edit each starts in.
   */
  _chunks(
    fn: (start: number, end: number, edit: Edit | undefined) => void,
  ): void {
    const { original, _bnd: bnd, _edits: edits } = this
    const len = original.length
    if (len === 0) return fn(0, 0, undefined)
    const runs = this._runs
    for (let r = 0, n = runs ? runs.length : 2; r < n; r += 2) {
      let s = runs ? runs[r] : 0
      const re = runs ? runs[r + 1] : len
      let b = upper(bnd, s)
      let k = edits.length ? this._editFrom(s) : 0
      while (s < re) {
        const e = b < bnd.length && bnd[b] < re ? bnd[b++] : re
        while (k < edits.length && edits[k].end <= s) k++
        fn(s, e, k < edits.length && edits[k].start <= s ? edits[k] : undefined)
        s = e
      }
    }
  }

  /** @internal */
  _order(): number[] {
    if (this._ord) return this._ord
    const out: number[] = []
    this._chunks((s, e) => {
      out.push(s, e)
    })
    return (this._ord = out)
  }

  /** @internal A chunk's content, whether it is edited, and its edit. */
  _chunkContent(
    start: number,
    end: number,
  ): [string, boolean, Edit | undefined] {
    const edit = this._editAt(start)
    if (!edit) return [this.original.slice(start, end), false, undefined]
    return [edit.seg && edit.start === start ? edit.content : '', true, edit]
  }

  /** @internal The output in order, as pieces of the state. */
  _pieces(): OutputPiece[] {
    const { original, _introAt: ins, _outroAt: outs } = this
    const len = original.length
    const pieces: OutputPiece[] = []
    if (this._gi) pieces.push({ k: 'gi', at: 0, text: this._gi })
    this._chunks((s, e, edit) => {
      const intro = len === 0 || s < len ? ins.get(s) : undefined
      if (intro) pieces.push({ k: 'in', at: s, text: intro })
      if (!edit) {
        if (s < e) pieces.push({ start: s, end: e })
      } else if (edit.seg && edit.start === s && edit.content) {
        pieces.push({ k: 'rep', at: s, text: edit.content })
      }
      const outro = len === 0 || e > 0 ? outs.get(e) : undefined
      if (outro) pieces.push({ k: 'out', at: e, text: outro })
    })
    if (this._go) pieces.push({ k: 'go', at: len, text: this._go })
    return pieces
  }

  /**
   * @internal The edits as a muggle-string rewrite: an insert per offset
   * (intros before the char at it, outros after the char before it, so that
   * they move with their chunk), a replacement per edit, split where a move
   * splits it, and after a move every run cut and placed in output order,
   * after the text before all of the output.
   */
  _rewrite(): SourceRewrite<Src, Named> {
    if (this._rw) return this._rw
    const { original, _src: source, _gi: gi, _go: go, _runs: runs } = this
    const len = original.length
    const rw = createSourceRewrite<Src, Named>(source)
    if (len === 0) {
      const text =
        gi + (this._introAt.get(0) || '') + (this._outroAt.get(0) || '') + go
      if (text) rw.insertAfter(0, text)
      return (this._rw = rw)
    }
    this._introAt.forEach((text, at) => {
      if (text) rw.insertBefore(at, text)
    })
    this._outroAt.forEach((text, at) => {
      if (text) rw.insertAfter(at, text)
    })
    const runStarts = runs
      ? runs.filter((_, i) => i % 2 === 0).sort((a, b) => a - b)
      : []
    for (const edit of this._edits) {
      let e = 0
      for (let s = edit.start, k = upper(runStarts, s); s < edit.end; s = e) {
        e =
          k < runStarts.length && runStarts[k] < edit.end
            ? runStarts[k++]
            : edit.end
        rw.replace(
          s,
          e,
          edit.seg && s === edit.start && edit.content
            ? edit.name !== undefined
              ? {
                  source,
                  start: s,
                  end: e,
                  text: edit.content,
                  name: edit.name,
                }
              : { source, start: s, end: e, text: edit.content }
            : '',
        )
      }
    }
    if (runs) {
      const cuts = []
      for (let r = 0; r < runs.length; r += 2) {
        cuts.push(rw.cut(runs[r], runs[r + 1]))
      }
      rw.insertAfter(0, gi ? [gi, ...cuts] : cuts)
    } else if (gi) {
      rw.insertAfter(0, gi)
    }
    if (go) rw.insertBefore(len, go)
    return (this._rw = rw)
  }

  /** @internal */
  _render(sink: Sink): void {
    this._rewrite().render(0, this.original.length, sink)
  }

  /**
   * With `hires` false, maps `char` of the original where it is kept.
   */
  addSourcemapLocation(char: number): void {
    this._locs.add(char)
  }

  append(content: string): this {
    if (typeof content !== 'string') {
      throw new TypeError('outro content must be a string')
    }
    this._go += content
    this._changed()
    return this
  }

  prepend(content: string): this {
    if (typeof content !== 'string') {
      throw new TypeError('outro content must be a string')
    }
    this._gi = content + this._gi
    this._changed()
    return this
  }

  /**
   * @internal An insert at `index`; one where no chunk ends (left) or starts
   * (right) goes before or after all of the output.
   */
  _insert(
    index: number,
    content: string,
    left: boolean,
    prepend: boolean,
  ): this {
    index = this._offsetIndex(index)
    if (typeof content !== 'string') {
      throw new TypeError('inserted content must be a string')
    }
    this._split(index)
    const len = this.original.length
    const outside =
      len === 0
        ? index !== 0
        : left
          ? index <= 0 || index > len
          : index < 0 || index >= len
    if (outside) {
      if (left) this._gi = prepend ? content + this._gi : this._gi + content
      else this._go = prepend ? content + this._go : this._go + content
    } else if (left) {
      this._addOutro(index, content, prepend)
    } else {
      this._addIntro(index, content, prepend)
    }
    this._changed()
    return this
  }

  appendLeft(index: number, content: string): this {
    return this._insert(index, content, true, false)
  }

  appendRight(index: number, content: string): this {
    return this._insert(index, content, false, false)
  }

  prependLeft(index: number, content: string): this {
    return this._insert(index, content, true, true)
  }

  prependRight(index: number, content: string): this {
    return this._insert(index, content, false, true)
  }

  clone(): this {
    const cloned = new (this.constructor as typeof EditedString)(
      this.original,
      { filename: this.filename, offset: this.offset },
    )
    if (this.indentExclusionRanges) {
      cloned.indentExclusionRanges = this.indentExclusionRanges.slice() as
        | ExclusionRange
        | Array<ExclusionRange>
    }
    cloned._gi = this._gi
    cloned._go = this._go
    cloned._introAt = new Map(this._introAt)
    cloned._outroAt = new Map(this._outroAt)
    // a clone renames nothing in its maps
    cloned._edits = this._edits.map(edit => ({ ...edit, name: undefined }))
    cloned._runs = this._runs && this._runs.slice()
    cloned._bnd = this._bnd.slice()
    cloned._locs = new Set(this._locs)
    return cloned as this
  }

  /** @internal The map of the output, with the mappings that `renderMap` gives. */
  _renderMap<M>(
    options: SourceMapOptions,
    renderMap: (
      render: (sink: Sink) => void,
      sourceName: (source: Src) => string,
    ) => { text: string; map: { names: string[]; mappings: M } },
  ): Omit<DecodedSourceMap, 'mappings'> & { mappings: M } {
    const sourceName = options.source
      ? relativePath(options.file || '', options.source)
      : options.file || ''
    const locs = options.hires ? null : [...this._locs].sort((a, b) => a - b)
    const { text, map } = renderMap(
      sink => this._render(locs ? coarse(sink, locs) : sink),
      () => sourceName,
    )
    if (this._str === null) this._str = text
    return {
      file: (options.file
        ? options.file.split(/[/\\]/).pop()
        : undefined) as string,
      sources: [sourceName],
      sourcesContent: options.includeContent ? [this.original] : undefined,
      names: map.names,
      mappings: map.mappings,
      x_google_ignoreList: this.ignoreList ? [0] : undefined,
    }
  }

  generateDecodedMap(options?: SourceMapOptions): DecodedSourceMap {
    return this._renderMap(options || {}, renderWithDecodedSourceMap)
  }

  generateMap(options?: SourceMapOptions): SourceMap {
    return new SourceMap(this._renderMap(options || {}, renderWithSourceMap))
  }

  /** @internal */
  _getRawIndentString(): string | null {
    if (this.indentStr === undefined)
      this.indentStr = guessIndent(this.original)
    return this.indentStr
  }

  getIndentString(): string {
    const indent = this._getRawIndentString()
    return indent === null ? '\t' : indent
  }

  /**
   * Indents the start of each line of the output but inserted content, with
   * the indentation the original uses if `indentStr` is not given.
   */
  indent(options?: IndentOptions): this
  indent(indentStr?: string, options?: IndentOptions): this
  indent(indentStr?: string | IndentOptions, options?: IndentOptions): this {
    if (isPlainObject(indentStr)) {
      options = indentStr as IndentOptions
      indentStr = undefined
    }
    const ind =
      indentStr === undefined
        ? this._getRawIndentString() || '\t'
        : (indentStr as string)
    if (ind === '') return this
    options = options || {}
    const excluded = excludedChars(options.exclude)
    let lineStart = options.indentStart !== false
    const indentLines = (text: string) =>
      text.replace(/^[^\r\n]/gm, char => {
        if (lineStart) return ind + char
        lineStart = true
        return char
      })
    this._gi = indentLines(this._gi)
    const ord = this._order().slice()
    let i = 0
    for (let p = 0; p < ord.length; p += 2) {
      const start = ord[p]
      const end = ord[p + 1]
      const [, edited, edit] = this._chunkContent(start, end)
      if (edited) {
        if (!excluded.has(i) && edit && edit.seg && edit.start === start) {
          edit.content = indentLines(edit.content)
          if (edit.content.length) {
            lineStart = edit.content[edit.content.length - 1] === '\n'
          }
        }
      } else {
        for (i = start; i < end; i++) {
          if (excluded.has(i)) continue
          const char = this.original[i]
          if (char === '\n') {
            lineStart = true
          } else if (char !== '\r' && lineStart) {
            lineStart = false
            this._addBound(i)
            this._addIntro(i, ind, true)
          }
        }
      }
      i = end
    }
    this._go = indentLines(this._go)
    this._changed()
    return this
  }

  move(start: number, end: number, index: number): this {
    start = this._offsetIndex(start)
    end = this._offsetIndex(end)
    index = this._offsetIndex(index)
    if (index >= start && index <= end) {
      throw new Error('Cannot move a selection inside itself')
    }
    this._split(start)
    this._split(end)
    this._split(index)
    const len = this.original.length
    if (start < 0 || end > len || index < 0 || index > len) {
      throw new Error('Character is out of bounds')
    }
    // the chunks in output order from the one that starts at `start` to the
    // one that ends at `end` move, before the one that starts at `index`
    const ord = this._order()
    let first = -1
    let last = -1
    let at = ord.length
    for (let p = 0; p < ord.length; p += 2) {
      if (ord[p] === start) first = p
      if (ord[p + 1] === end) last = p
      if (ord[p] === index) at = p
    }
    if (first < 0 || last < first) {
      if (start === end) return this
      throw new Error(
        `Cannot move ${start}..${end}: the chunk that ends at ${end} is not after the one that starts at ${start}`,
      )
    }
    if (at >= first && at <= last) {
      throw new Error('Cannot move a selection inside itself')
    }
    const moved = ord.slice(first, last + 2)
    const rest = ord.slice(0, first).concat(ord.slice(last + 2))
    const to =
      at === ord.length ? rest.length : at < first ? at : at - moved.length
    const order = rest.slice(0, to).concat(moved, rest.slice(to))
    const runs: number[] = []
    for (let p = 0; p < order.length; p += 2) {
      if (runs.length && runs[runs.length - 1] === order[p]) {
        runs[runs.length - 1] = order[p + 1]
      } else {
        runs.push(order[p], order[p + 1])
      }
    }
    this._runs = runs.length === 2 ? null : runs
    this._ord = null
    this._changed()
    return this
  }

  overwrite(
    start: number,
    end: number,
    content: string,
    options?: boolean | OverwriteOptions,
  ): this {
    const o = (typeof options === 'object' && options) || {}
    return this.update(start, end, content, {
      storeName: o.storeName,
      overwrite: !o.contentOnly,
    })
  }

  update(
    start: number,
    end: number,
    content: string,
    options?: boolean | UpdateOptions,
  ): this {
    if (typeof content !== 'string') {
      throw new TypeError('replacement content must be a string')
    }
    start = this._rangeIndex(start)
    end = this._rangeIndex(end)
    if (end > this.original.length) throw new Error('end is out of bounds')
    if (start === end) {
      throw new Error(
        'Cannot overwrite a zero-length range – use appendLeft or prependRight instead',
      )
    }
    if (start < 0) throw new Error('Character is out of bounds')
    this._split(start)
    this._split(end)
    if (start > end) throw new Error('Cannot overwrite across a split point')
    const o =
      options === true ? { storeName: true } : (options as UpdateOptions) || {}
    const runs = this._runs
    if (runs) {
      let r = 0
      while (!(runs[r] <= start && start < runs[r + 1])) r += 2
      if (runs[r + 1] < end) {
        throw new Error('Cannot overwrite across a split point')
      }
    }
    if (o.overwrite) this._clearInserts(start, end, start, end)
    else this._clearInserts(start + 1, end, this._chunkEnd(start), end)
    const at = this._carve(start, end)
    this._edits.splice(at, 0, {
      start,
      end,
      content,
      seg: true,
      name: o.storeName ? this.original.slice(start, end) : undefined,
    })
    this._changed()
    return this
  }

  remove(start: number, end: number): this {
    start = this._rangeIndex(start)
    end = this._rangeIndex(end)
    if (start === end) return this
    if (start < 0 || end > this.original.length) {
      throw new Error('Character is out of bounds')
    }
    if (start > end) throw new Error('end must be greater than start')
    this._split(start)
    this._split(end)
    this._clearInserts(start, end, start, end)
    this._markRemoved(start, end)
    this._changed()
    return this
  }

  reset(start: number, end: number): this {
    start = this._rangeIndex(start)
    end = this._rangeIndex(end)
    if (start === end) return this
    if (start < 0 || end > this.original.length) {
      throw new Error('Character is out of bounds')
    }
    if (start > end) throw new Error('end must be greater than start')
    this._split(start)
    this._split(end)
    this._clearInserts(start, end, start, end)
    this._carve(start, end)
    this._changed()
    return this
  }

  lastChar(): string {
    const s = this.toString()
    return s.length ? s[s.length - 1] : ''
  }

  lastLine(): string {
    const s = this.toString()
    return s.slice(s.lastIndexOf('\n') + 1)
  }

  slice(
    start: number = 0,
    end: number = this.original.length - this.offset,
  ): string {
    start = this._rangeIndex(start)
    end = this._rangeIndex(end)
    const ord = this._order()
    const len = this.original.length
    let result = ''
    let p = 0
    while (p < ord.length && (ord[p] > start || ord[p + 1] <= start)) {
      if (ord[p] < end && ord[p + 1] >= end) return result
      p += 2
    }
    if (
      p < ord.length &&
      this._chunkContent(ord[p], ord[p + 1])[1] &&
      ord[p] !== start
    ) {
      throw new Error(
        `Cannot use replaced character ${start} as slice start anchor.`,
      )
    }
    const first = p
    for (; p < ord.length; p += 2) {
      const cs = ord[p]
      const ce = ord[p + 1]
      const intro = len === 0 || cs < len ? this._introAt.get(cs) : undefined
      if (intro && (first !== p || cs === start)) result += intro
      const [content, edited] = this._chunkContent(cs, ce)
      const containsEnd = cs < end && ce >= end
      if (containsEnd && edited && ce !== end) {
        throw new Error(
          `Cannot use replaced character ${end} as slice end anchor.`,
        )
      }
      const sliceStart = first === p ? start - cs : 0
      const sliceEnd = containsEnd ? content.length + end - ce : content.length
      result += content.slice(sliceStart, sliceEnd)
      const outro = len === 0 || ce > 0 ? this._outroAt.get(ce) : undefined
      if (outro && (!containsEnd || ce === end)) result += outro
      if (containsEnd) break
    }
    return result
  }

  snip(start: number, end: number): this {
    const clone = this.clone()
    clone.remove(0, start)
    clone.remove(end, clone.original.length)
    return clone
  }

  toString(): string {
    if (this._str !== null) return this._str
    let text = ''
    this._render(piece => {
      text += rewritePieceText(piece)
    })
    return (this._str = text)
  }

  /** Whether the output but the text prepended and appended to all of it is blank. */
  isEmpty(): boolean {
    const s = this.toString()
    return !s.slice(this._gi.length, s.length - this._go.length).trim()
  }

  /** The length of the output but the text prepended and appended to all of it. */
  length(): number {
    return this.toString().length - this._gi.length - this._go.length
  }

  trimLines(): this {
    return this.trim('[\\r\\n]')
  }

  trim(charType?: string): this {
    return this.trimStart(charType).trimEnd(charType)
  }

  trimEnd(charType?: string): this {
    const rx = new RegExp(`${charType || '\\s'}+$`)
    const pieces = this._pieces()
    for (let i = pieces.length - 1; i >= 0; i--) {
      if (pieces[i].k === 'gi') break
      if (this._trimPiece(pieces[i], rx, true)) break
    }
    this._changed()
    return this
  }

  trimStart(charType?: string): this {
    const rx = new RegExp(`^${charType || '\\s'}+`)
    for (const piece of this._pieces()) {
      if (piece.k === 'go') break
      if (this._trimPiece(piece, rx, false)) break
    }
    this._changed()
    return this
  }

  /** @internal Trims a piece; returns whether any of it is left. */
  _trimPiece(p: OutputPiece, rx: RegExp, fromEnd: boolean): boolean {
    switch (p.k) {
      case 'gi':
        this._gi = this._gi.replace(rx, '')
        return this._gi.length > 0
      case 'go':
        this._go = this._go.replace(rx, '')
        return this._go.length > 0
      case 'in': {
        const text = p.text.replace(rx, '')
        this._introAt.set(p.at, text)
        return text.length > 0
      }
      case 'out': {
        const text = p.text.replace(rx, '')
        this._outroAt.set(p.at, text)
        return text.length > 0
      }
      case 'rep': {
        const i = this._editFrom(p.at)
        const edit = this._edits[i]
        const trimmed = edit.content.replace(rx, '')
        const end = this._chunkEnd(p.at)
        // a trimmed replacement keeps the part of its chunk that trimming the
        // original by as many chars would keep, the rest of the chunk removed;
        // it no longer starts at the original it renames
        const cut = fromEnd ? p.at + trimmed.length : end - trimmed.length
        if (trimmed && trimmed !== edit.content && cut > p.at && cut < end) {
          const removed: Edit = {
            start: fromEnd ? cut : edit.start,
            end: fromEnd ? edit.end : cut,
            content: '',
            seg: false,
            name: undefined,
          }
          const kept = fromEnd
            ? { ...edit, end: cut, content: trimmed, name: undefined }
            : { ...edit, start: cut, content: trimmed, name: undefined }
          this._edits.splice(
            i,
            1,
            ...(fromEnd ? [kept, removed] : [removed, kept]),
          )
          this._addBound(cut)
        } else {
          edit.content = trimmed
        }
        return trimmed.length > 0
      }
      default: {
        const text = this.original.slice(p.start, p.end)
        const trimmed = text.replace(rx, '')
        if (trimmed === text) return text.length > 0
        const cut = fromEnd ? p.start + trimmed.length : p.end - trimmed.length
        if (fromEnd) this._markRemoved(cut, p.end)
        else this._markRemoved(p.start, cut)
        this._addBound(cut)
        return trimmed.length > 0
      }
    }
  }

  hasChanged(): boolean {
    return this.original !== this.toString()
  }

  /** @internal */
  _replaceRegexp(
    searchValue: RegExp,
    replacement: string | ((substring: string, ...args: any[]) => string),
  ): this {
    const str = this.original
    const replace = (match: RegExpExecArray) => {
      const text =
        typeof replacement === 'string'
          ? replacement.replace(/\$(\$|&|\d+)/g, (_, i: string) => {
              if (i === '$') return '$'
              if (i === '&') return match[0]
              return +i < match.length ? match[+i] : `$${i}`
            })
          : replacement(
              ...(match as unknown as [string]),
              match.index,
              str,
              match.groups,
            )
      if (text !== match[0]) {
        this.overwrite(match.index, match.index + match[0].length, text)
      }
    }
    if (searchValue.global) {
      const matches: RegExpExecArray[] = []
      let match
      while ((match = searchValue.exec(str))) {
        matches.push(match)
        if (!match[0]) searchValue.lastIndex++
      }
      matches.forEach(replace)
    } else {
      const match = searchValue.exec(str)
      if (match) replace(match)
    }
    return this
  }

  replace(
    regex: RegExp | string,
    replacement: string | ((substring: string, ...args: any[]) => string),
  ): this {
    if (typeof regex !== 'string')
      return this._replaceRegexp(regex, replacement)
    const { original } = this
    const index = original.indexOf(regex)
    if (index !== -1) {
      const text =
        typeof replacement === 'function'
          ? replacement(regex, index, original)
          : replacement
      if (text !== regex) this.overwrite(index, index + regex.length, text)
    }
    return this
  }

  replaceAll(
    regex: RegExp | string,
    replacement: string | ((substring: string, ...args: any[]) => string),
  ): this {
    if (typeof regex !== 'string') {
      if (!regex.global) {
        throw new TypeError(
          'replaceAll called with a non-global RegExp argument',
        )
      }
      return this._replaceRegexp(regex, replacement)
    }
    const { original } = this
    const step = regex.length || 1
    for (
      let index = original.indexOf(regex);
      index !== -1;
      index = original.indexOf(regex, index + step)
    ) {
      const previous = original.slice(index, index + regex.length)
      const text =
        typeof replacement === 'function'
          ? replacement(previous, index, original)
          : replacement
      if (previous === text) continue
      if (regex.length) this.overwrite(index, index + regex.length, text)
      else this.appendRight(index, text)
      if (index === original.length) break
    }
    return this
  }
}
