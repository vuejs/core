import { parseExpression } from '@babel/parser'
import { type CompilerError, defaultOnWarn } from '../errors'
import type { CompilerOptions } from '../options'
import {
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  NodeTypes,
  type RootNode,
  type SimpleExpressionNode,
  type SourceLocation,
  type TemplateChildNode,
  createSimpleExpression,
} from '../ast'
import { findDir, findProp, isCommentOrWhitespace } from '../utils'
import {
  type MatchArm,
  PatternSyntaxError,
  generateMatchSelector,
  parseMatchPattern,
} from '../patterns'

/**
 * RFC 823 reference lowering, shared by VDOM, SSR and Vapor. The selector is
 * evaluated once in a lexical scope. Existing structural traversal tracks
 * binding/slot scopes; code generation returns the selected conditional branch
 * directly, without introducing list fragments or runtime directives.
 * Keeping selection out of the render bodies also preserves empty arms.
 */
export function lowerMatchDirectives(
  ast: RootNode,
  options: Pick<CompilerOptions, 'onError' | 'onWarn'>,
): void {
  let id = 0
  let prefix = '__vue_match'
  while (ast.source.includes(prefix)) prefix += '_'

  function report(message: string, loc: SourceLocation, warning = false) {
    const error = new SyntaxError(message) as CompilerError
    error.code = warning ? 'V_MATCH_WARNING' : 'V_MATCH_SYNTAX'
    error.loc = loc
    if (warning) (options.onWarn || defaultOnWarn)(error)
    else if (options.onError) options.onError(error)
    else throw error
  }

  function template(
    children: TemplateChildNode[],
    loc: SourceLocation,
  ): ElementNode {
    return {
      type: NodeTypes.ELEMENT,
      tag: 'template',
      tagType: ElementTypes.TEMPLATE,
      ns: 0,
      props: [],
      children,
      loc,
      codegenNode: undefined,
    }
  }
  function expression(content: string, loc: SourceLocation, params = false) {
    const exp = createSimpleExpression(content, false, loc)
    if (!__BROWSER__)
      exp.ast = parseExpression(
        params ? `(${content}) => {}` : `(${content})`,
        { plugins: ['typescript'] },
      )
    return exp
  }
  function directive(
    name: string,
    content: string,
    loc: SourceLocation,
  ): DirectiveNode {
    return {
      type: NodeTypes.DIRECTIVE,
      name,
      rawName: `v-${name}`,
      exp: expression(content, loc),
      arg: undefined,
      modifiers: [],
      loc,
    }
  }
  function scope(
    children: TemplateChildNode[],
    value: string,
    source: string,
    loc: SourceLocation,
    sourceRanges?: SimpleExpressionNode['sourceRanges'],
  ): ElementNode {
    const node = template(children, loc)
    const dir = directive('for', `${value} in [${source}]`, loc)
    const sourceExpression = expression(`[${source}]`, loc)
    sourceExpression.sourceRanges = sourceRanges?.map(range => ({
      ...range,
      start: range.start + 1,
      end: range.end + 1,
    }))
    dir.forParseResult = {
      source: sourceExpression,
      value: expression(value, loc, true),
      key: undefined,
      index: undefined,
      finalized: false,
      matchScope: true,
    }
    node.props.push(dir)
    return node
  }
  function visit(node: RootNode | TemplateChildNode) {
    if (node.type !== NodeTypes.ELEMENT && node.type !== NodeTypes.ROOT) return
    if (node.type === NodeTypes.ELEMENT) {
      const orphan = findDir(node, 'when', true)
      if (orphan) {
        report('v-when must be a direct child of v-match.', orphan.loc)
        node.props.splice(node.props.indexOf(orphan), 1)
      }
      const match = findDir(node, 'match', true)
      if (match) {
        node.props.splice(node.props.indexOf(match), 1)
        if (
          !match.exp ||
          match.exp.type !== NodeTypes.SIMPLE_EXPRESSION ||
          !match.exp.content.trim() ||
          match.arg ||
          match.modifiers.length
        ) {
          report(
            'v-match requires a subject expression and accepts no arguments or modifiers.',
            match.loc,
          )
          match.exp = expression('undefined', match.loc)
        }
        const arms: MatchArm[] = []
        const elements: ElementNode[] = []
        let fallback = false
        for (const child of node.children) {
          if (isCommentOrWhitespace(child)) continue
          const when =
            child.type === NodeTypes.ELEMENT && findDir(child, 'when', true)
          if (!when || child.type !== NodeTypes.ELEMENT) {
            report(
              'Every direct child of v-match must declare v-when; this child is ignored.',
              child.loc,
              true,
            )
            continue
          }
          if (
            when.arg ||
            when.modifiers.length ||
            !when.exp ||
            when.exp.type !== NodeTypes.SIMPLE_EXPRESSION
          ) {
            report(
              'v-when requires a pattern and accepts no arguments or modifiers.',
              when.loc,
            )
            continue
          }
          if (findDir(child, /^(if|else-if|else|for|match)$/, true)) {
            report(
              'v-when cannot share an element with v-if, v-else-if, v-else, v-for or v-match.',
              when.loc,
            )
            continue
          }
          try {
            const arm = parseMatchPattern(when.exp.content)
            if (!__BROWSER__ && arm.guard) {
              try {
                parseExpression(`(${arm.guard.text})`, {
                  plugins: ['typescript'],
                })
              } catch (error) {
                throw new PatternSyntaxError(
                  `Invalid pattern guard: ${(error as Error).message}`,
                  arm.guard.start,
                )
              }
            }
            if (fallback)
              report(
                'An unguarded wildcard arm must be last and unique.',
                when.loc,
              )
            if (arm.pattern.kind === 'wildcard' && !arm.guard) fallback = true
            child.props.splice(child.props.indexOf(when), 1)
            // Binding scopes below surround the complete arm, including props.
            elements.push(child)
            arms.push(arm)
          } catch (error) {
            if (!(error instanceof PatternSyntaxError)) throw error
            report(error.message, when.exp.loc)
          }
        }
        if (!arms.length) report('v-match has no v-when arms.', match.loc, true)
        const local = `${prefix}_${id++}`
        const branches = elements.map((child, index) => {
          const arm = arms[index]
          const content =
            child.tagType === ElementTypes.TEMPLATE ? child.children : [child]
          const once =
            child.tagType === ElementTypes.TEMPLATE &&
            findDir(child, 'once', true)
          const bindings =
            arm.bindings.length || once
              ? scope(
                  content,
                  `[, ${arm.bindings.map(b => b.name).join(', ')}]`,
                  local,
                  child.loc,
                )
              : undefined
          if (once) bindings!.props.push(once)
          const branch = template(bindings ? [bindings] : content, child.loc)
          const key =
            child.tagType === ElementTypes.TEMPLATE &&
            findProp(child, 'key', false, true)
          if (key) (bindings || branch).props.push(key)
          branch.props.push(
            directive(
              index ? 'else-if' : 'if',
              `${local}[0] === ${index}`,
              child.loc,
            ),
          )
          return branch
        })
        const selection = generateMatchSelector(
          arms,
          match.exp.content,
          `${local}_select`,
        )
        const matchScope = scope(branches, local, selection.code, match.loc, [
          {
            start: selection.subjectOffset,
            end: selection.subjectOffset + match.exp.content.length,
            loc: match.exp.loc,
          },
        ])
        if (
          node.tag === 'template' &&
          !findDir(node, /^(if|else-if|else|for|slot)$/, true)
        ) {
          node.tagType = ElementTypes.TEMPLATE
          node.props = [...matchScope.props, ...node.props]
          node.children = branches
        } else {
          node.children = [matchScope]
        }
      }
    }
    for (const child of node.children) visit(child)
  }
  visit(ast)
}
