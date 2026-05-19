import type { CodegenContext } from '../generate'
import { DynamicFlag, type IRDynamicInfo, type IRTemplate } from '../ir'
import { TemplateFlags } from '@vue/shared'
import { genDirectivesForElement } from './directive'
import { genOperationWithInsertionState } from './operation'
import {
  type CodeFragment,
  type CodeFragments,
  IMPORT_EXPR_RE,
  NEWLINE,
  buildCodeFragment,
  genCall,
} from './utils'

export function genTemplates(
  templates: IRTemplate[],
  context: CodegenContext,
): string {
  const result: string[] = []
  templates.forEach(({ content, ns, root, static: isStatic }, i) => {
    let args = JSON.stringify(content).replace(
      // replace import expressions with string concatenation
      IMPORT_EXPR_RE,
      `" + $1 + "`,
    )

    const flags =
      (root ? TemplateFlags.ROOT : 0) | (isStatic ? TemplateFlags.STATIC : 0)
    if (flags || ns) {
      args += `, ${flags}`
    }

    if (ns) {
      args += `, ${ns}`
    }

    result.push(
      `const ${context.tName(i)} = ${context.helper('template')}(${args})\n`,
    )
  })
  return result.join('')
}

type FlushBeforeDynamic = (
  dynamic: IRDynamicInfo,
  push: (...items: CodeFragment[]) => number,
) => void

export function genSelf(
  dynamic: IRDynamicInfo,
  context: CodegenContext,
  flushBeforeDynamic?: FlushBeforeDynamic,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  const { id, template, operation, hasDynamicChild } = dynamic

  if (id !== undefined && template !== undefined) {
    push(NEWLINE, `const n${id} = ${context.tName(template)}()`)
    push(...genDirectivesForElement(id, context))
  }

  if (operation) {
    push(...genOperationWithInsertionState(operation, context))
  }

  if (hasDynamicChild) {
    push(...genChildren(dynamic, context, push, `n${id}`, flushBeforeDynamic))
  }

  return frag
}

export function genChildren(
  dynamic: IRDynamicInfo,
  context: CodegenContext,
  pushBlock: (...items: CodeFragment[]) => number,
  from: CodeFragments = `n${dynamic.id}`,
  flushBeforeDynamic?: FlushBeforeDynamic,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  const { children } = dynamic

  let offset = 0
  /**
   * `reusable` means the previous access target is a p* cursor that can be
   * reassigned by the next lookup. Referenced n* variables must stay stable.
   */
  let prev:
    | [variable: string, elementIndex: number, reusable: boolean]
    | undefined

  for (const [index, child] of children.entries()) {
    if (child.flags & DynamicFlag.NON_TEMPLATE) {
      offset--
    }

    if (child.flags & DynamicFlag.INSERT && child.template != null) {
      flushBeforeDynamic && flushBeforeDynamic(child, push)
      push(...genSelf(child, context, flushBeforeDynamic))
      continue
    }

    const id =
      child.flags & DynamicFlag.REFERENCED
        ? child.flags & DynamicFlag.INSERT
          ? child.anchor
          : child.id
        : undefined

    if (id === undefined && !child.hasDynamicChild) {
      flushBeforeDynamic && flushBeforeDynamic(child, push)
      push(...genSelf(child, context, flushBeforeDynamic))
      continue
    }

    const elementIndex = index + offset
    const logicalIndex =
      child.logicalIndex !== undefined ? String(child.logicalIndex) : undefined
    const inlinePlaceholder =
      id === undefined &&
      canInlinePlaceholder(child) &&
      child.template == null &&
      child.operation === undefined &&
      !(child.flags & (DynamicFlag.INSERT | DynamicFlag.NON_TEMPLATE))
    const accessPath = genAccessPath(
      context,
      from,
      child,
      elementIndex,
      logicalIndex,
      prev,
    )

    if (inlinePlaceholder) {
      if (prev && prev[2]) {
        push(
          ...genChildren(
            child,
            context,
            pushBlock,
            ['(', prev[0], ' = ', ...accessPath, ')'],
            flushBeforeDynamic,
          ),
        )
        prev = [prev[0], elementIndex, true]
        continue
      }

      if (
        !hasAdjacentFollowingAccessChild(children, index, elementIndex, offset)
      ) {
        push(
          ...genChildren(
            child,
            context,
            pushBlock,
            accessPath,
            flushBeforeDynamic,
          ),
        )
        continue
      }
    }

    let variable: string
    if (id === undefined && prev && prev[2]) {
      variable = prev[0]
      pushBlock(NEWLINE, `${variable} = `, ...accessPath)
    } else {
      // p for "placeholder" variables that are meant for possible reuse by
      // other access paths
      variable =
        id === undefined ? context.pName(context.block.tempId++) : `n${id}`
      pushBlock(
        NEWLINE,
        id === undefined ? `let ${variable} = ` : `const ${variable} = `,
        ...accessPath,
      )
    }

    if (id === child.anchor && !child.hasDynamicChild) {
      flushBeforeDynamic && flushBeforeDynamic(child, push)
      push(...genSelf(child, context, flushBeforeDynamic))
    }

    if (id !== undefined) {
      push(...genDirectivesForElement(id, context))
    }

    prev = [variable, elementIndex, id === undefined]
    push(
      ...genChildren(child, context, pushBlock, variable, flushBeforeDynamic),
    )
  }

  return frag
}

/**
 * Build one DOM lookup path while preserving the fast sibling walk:
 * adjacent nodes use _next(prev), otherwise fall back to _nthChild(parent).
 */
function genAccessPath(
  { helper }: CodegenContext,
  from: CodeFragments,
  child: IRDynamicInfo,
  elementIndex: number,
  logicalIndex: string | undefined,
  prev: [variable: string, elementIndex: number, reusable: boolean] | undefined,
): CodeFragment[] {
  if (prev) {
    return elementIndex - prev[1] === 1
      ? genCall(helper('next'), prev[0], logicalIndex)
      : genNthChild(helper('nthChild'), from, elementIndex, logicalIndex)
  }

  if (elementIndex === 0) {
    return genCall(
      helper('child'),
      from,
      child.logicalIndex !== 0 ? logicalIndex : undefined,
    )
  }

  // check if there's a node that we can reuse from
  const firstChild = genCall(helper('child'), from)
  return elementIndex === 1
    ? genCall(helper('next'), firstChild, logicalIndex)
    : genNthChild(helper('nthChild'), from, elementIndex, logicalIndex)
}

/**
 * Only inline a placeholder when materializing it would not save a parent
 * lookup. If its child tree needs the parent more than once, keep p* so the
 * generated code does not duplicate _child/_nthChild work.
 */
function canInlinePlaceholder(dynamic: IRDynamicInfo): boolean {
  return (
    dynamic.hasDynamicChild === true && countParentAccessUsages(dynamic) === 1
  )
}

/**
 * A following access can reuse the current placeholder cursor only when it is
 * the next DOM sibling. Gapped siblings need _nthChild(parent, index) instead.
 */
function hasAdjacentFollowingAccessChild(
  children: IRDynamicInfo[],
  index: number,
  elementIndex: number,
  offset: number,
): boolean {
  let futureOffset = offset
  for (let i = index + 1; i < children.length; i++) {
    const child = children[i]
    if (child.flags & DynamicFlag.NON_TEMPLATE) {
      futureOffset--
    }
    if (
      !(child.flags & DynamicFlag.INSERT && child.template != null) &&
      (!!(child.flags & DynamicFlag.REFERENCED) || child.hasDynamicChild)
    ) {
      return i + futureOffset - elementIndex === 1
    }
  }

  return false
}

/**
 * Mirrors genChildren's traversal closely enough to count how many emitted
 * access paths would start from this placeholder's parent. This is the guard
 * that keeps inline placeholders from duplicating parent lookups.
 */
function countParentAccessUsages(dynamic: IRDynamicInfo): number {
  let usages = 0
  let offset = 0
  let prev: [elementIndex: number, reusable: boolean] | undefined

  for (const [index, child] of dynamic.children.entries()) {
    if (child.flags & DynamicFlag.NON_TEMPLATE) {
      offset--
    }

    if (child.flags & DynamicFlag.INSERT && child.template != null) {
      continue
    }

    const id =
      child.flags & DynamicFlag.REFERENCED
        ? child.flags & DynamicFlag.INSERT
          ? child.anchor
          : child.id
        : undefined

    if (id === undefined && !child.hasDynamicChild) {
      continue
    }

    const elementIndex = index + offset
    const usesParent = !prev || elementIndex - prev[0] !== 1
    const inlinePlaceholder =
      id === undefined &&
      canInlinePlaceholder(child) &&
      child.template == null &&
      child.operation === undefined &&
      !(child.flags & (DynamicFlag.INSERT | DynamicFlag.NON_TEMPLATE))

    if (inlinePlaceholder) {
      if (prev && prev[1]) {
        if (usesParent) usages++
        prev = [elementIndex, true]
        continue
      }

      if (
        !hasAdjacentFollowingAccessChild(
          dynamic.children,
          index,
          elementIndex,
          offset,
        )
      ) {
        if (usesParent) usages++
        continue
      }
    }

    if (usesParent) usages++
    prev = [elementIndex, id === undefined]
  }

  return usages
}

function genNthChild(
  nthChild: string,
  from: CodeFragments,
  elementIndex: number,
  logicalIndex: string | undefined,
): CodeFragment[] {
  const index = String(elementIndex)
  return genCall(
    nthChild,
    from,
    index,
    // nthChild defaults the logical index to the element index at runtime, so
    // the third argument is only needed when hydration uses a different index.
    logicalIndex === index ? undefined : logicalIndex,
  )
}
