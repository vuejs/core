import { type SourceLocation, createPieceWriter } from '@vue/compiler-dom'
import { isArray, isString } from '@vue/shared'
import type { CodegenContext } from '../generate'
import type { ParserOptions } from '@babel/parser'

/**
 * Run a helper call inside the once ambient: a helper that creates its own
 * effects at a v-once site has them run once like compiled ones do.
 */
export function genOnce(
  call: CodeFragment[],
  context: CodegenContext,
): CodeFragment[] {
  return genCall(context.helper('withOnce'), ['() => ', call])
}

export const IMPORT_EXP_START = '__IMPORT_EXP_START__'
export const IMPORT_EXP_END = '__IMPORT_EXP_END__'
export const IMPORT_EXPR_RE: RegExp = new RegExp(
  `${IMPORT_EXP_START}(.*?)${IMPORT_EXP_END}`,
  'g',
)

export const NEWLINE: unique symbol = Symbol(__DEV__ ? `newline` : ``)
export const INDENT_START: unique symbol = Symbol(__DEV__ ? `indent start` : ``)
export const INDENT_END: unique symbol = Symbol(__DEV__ ? `indent end` : ``)

type FalsyValue = false | null | undefined
/** code with its source position; the newline index tells it apart from a nested list */
export type MappedFragment = [
  code: string,
  newlineIndex: number,
  loc?: SourceLocation,
  /** the identifier of the source that `code` renames */
  name?: string,
]
/** the code generated for a node with a source, which the piece writer takes as its `enclosing` */
export interface NodeFragments {
  loc: SourceLocation
  code: CodeFragment[]
}
export type CodeFragment =
  | typeof NEWLINE
  | typeof INDENT_START
  | typeof INDENT_END
  | string
  | MappedFragment
  | NodeFragments
  // a generator's output, pushed as one item instead of being spread
  | CodeFragment[]
  | FalsyValue

export function isNestedFragments(frag: CodeFragment): frag is CodeFragment[] {
  return isArray(frag) && typeof frag[1] !== 'number'
}

/** the fragments nested in `frag`, if it nests any */
export function innerFragments(frag: CodeFragment): CodeFragment[] | undefined {
  return isNestedFragments(frag)
    ? frag
    : isNodeFragments(frag)
      ? frag.code
      : undefined
}

export function isNodeFragments(frag: CodeFragment): frag is NodeFragments {
  return !!frag && typeof frag === 'object' && !isArray(frag)
}
export type CodeFragments = Exclude<CodeFragment, any[]> | CodeFragment[]

export function buildCodeFragment(
  ...frag: CodeFragment[]
): [
  CodeFragment[],
  (...items: CodeFragment[]) => number,
  (...items: CodeFragment[]) => number,
] {
  const push = frag.push.bind(frag)
  const unshift = frag.unshift.bind(frag)
  return [frag, push, unshift]
}

export type CodeFragmentDelimiters = [
  left: CodeFragments,
  right: CodeFragments,
  delimiter: CodeFragments,
  placeholder?: CodeFragments,
]

export function genMulti(
  [left, right, seg, placeholder]: CodeFragmentDelimiters,
  ...frags: CodeFragments[]
): CodeFragment[] {
  const frag: CodeFragment[] = [left]
  pushJoined(frag, frags, seg, placeholder)
  frag.push(right)
  return frag
}

// with a placeholder, trailing empty arguments are dropped and inner ones take
// the placeholder; without one, empty arguments are skipped
function pushJoined(
  frag: CodeFragment[],
  frags: CodeFragments[],
  seg: CodeFragments,
  placeholder: CodeFragments | undefined,
) {
  let end = frags.length
  if (placeholder) {
    while (end > 0 && !frags[end - 1]) end--
  }
  let first = true
  for (let i = 0; i < end; i++) {
    let fn = frags[i]
    if (!fn) {
      if (!placeholder) continue
      fn = placeholder
    }
    if (!first) frag.push(seg)
    frag.push(fn)
    first = false
  }
}
export const DELIMITERS_ARRAY: CodeFragmentDelimiters = ['[', ']', ', ']
export const DELIMITERS_ARRAY_NEWLINE: CodeFragmentDelimiters = [
  ['[', INDENT_START, NEWLINE],
  [INDENT_END, NEWLINE, ']'],
  [',', NEWLINE],
]
export const DELIMITERS_OBJECT: CodeFragmentDelimiters = ['{ ', ' }', ', ']
export const DELIMITERS_OBJECT_NEWLINE: CodeFragmentDelimiters = [
  ['{', INDENT_START, NEWLINE],
  [INDENT_END, NEWLINE, '}'],
  [',', NEWLINE],
]

export function genCall(
  name: string | [name: string, placeholder?: CodeFragments],
  ...frags: CodeFragments[]
): CodeFragment[] {
  const hasPlaceholder = isArray(name)
  const fnName = hasPlaceholder ? name[0] : name
  const placeholder = hasPlaceholder ? name[1] : 'null'
  const frag: CodeFragment[] = [fnName, '(']
  pushJoined(frag, frags, ', ', placeholder)
  frag.push(')')
  return frag
}

export function getParserOptions(
  plugins: CodegenContext['options']['expressionPlugins'],
): ParserOptions {
  return {
    plugins: plugins
      ? plugins.some(plugin => plugin === 'typescript')
        ? plugins
        : [...plugins, 'typescript']
      : ['typescript'],
  }
}

export function codeFragmentToString(
  code: CodeFragment[],
  context: CodegenContext,
): string {
  const writer =
    !__BROWSER__ && context.options.sourceMap
      ? createPieceWriter(
          context.options.pieceSource || { content: context.ir.source },
          context.options.pieceOffset || 0,
        )
      : undefined
  if (writer) context.pieces = writer.pieces

  let codegen = ''
  let indentLevel = 0

  emit(code)

  return codegen

  function emit(code: CodeFragment[]) {
    for (const frag of code) {
      if (!frag) continue
      if (isNestedFragments(frag)) {
        emit(frag)
      } else if (isNodeFragments(frag)) {
        const enclosing = writer && writer.enclosing
        if (writer) writer.enclosing = frag.loc
        emit(frag.code)
        if (writer) writer.enclosing = enclosing
      } else if (frag === NEWLINE) {
        const code = `\n${`  `.repeat(indentLevel)}`
        codegen += code
        if (writer) writer.newline(code)
      } else if (frag === INDENT_START) {
        indentLevel++
      } else if (frag === INDENT_END) {
        indentLevel--
      } else if (isString(frag)) {
        codegen += frag
        if (writer) writer.write(frag)
      } else {
        const [code, , loc, name] = frag
        codegen += code
        if (writer) writer.write(code, loc, name)
      }
    }
  }
}

/** Formats a numeric flags argument with its dev-only name annotation. */
export function genFlags(flags: number, names: string[]): string {
  return __DEV__ ? `${flags} /* ${names.join(', ')} */` : String(flags)
}
