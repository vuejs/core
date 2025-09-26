import type { CodegenContext } from '../generate'
import {
  DynamicFlag,
  type IRDynamicInfo,
  type InsertionStateTypes,
} from '../ir'
import { genDirectivesForElement } from './directive'
import { genOperationWithInsertionState } from './operation'
import { type CodeFragment, NEWLINE, buildCodeFragment, genCall } from './utils'

export function genTemplates(
  templates: string[],
  rootIndex: number | undefined,
  { helper }: CodegenContext,
): string {
  return templates
    .map(
      (template, i) =>
        `const t${i} = ${helper('template')}(${JSON.stringify(
          template,
        )}${i === rootIndex ? ', true' : ''})\n`,
    )
    .join('')
}

export function genSelf(
  dynamic: IRDynamicInfo,
  context: CodegenContext,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  const { id, template, operation, hasDynamicChild } = dynamic

  if (id !== undefined && template !== undefined) {
    push(NEWLINE, `const n${id} = t${template}()`)
    push(...genDirectivesForElement(id, context))
  }

  if (operation) {
    push(...genOperationWithInsertionState(operation, context))
  }

  if (hasDynamicChild) {
    push(...genChildren(dynamic, context, push, `n${id}`))
  }

  return frag
}

export function genChildren(
  dynamic: IRDynamicInfo,
  context: CodegenContext,
  pushBlock: (...items: CodeFragment[]) => number,
  from: string = `n${dynamic.id}`,
): CodeFragment[] {
  const { helper } = context
  const [frag, push] = buildCodeFragment()
  const { children } = dynamic

  let offset = 0
  let prev: [variable: string, elementIndex: number] | undefined
  let ifBranchCount = 0
  let prependCount = 0

  for (const [index, child] of children.entries()) {
    if (child.ifBranch) ifBranchCount++
    if (
      child.operation &&
      (child.operation as InsertionStateTypes).anchor === -1
    ) {
      prependCount++
    }
    if (child.flags & DynamicFlag.NON_TEMPLATE) {
      if (!child.ifBranch) offset--
    }

    const id =
      child.flags & DynamicFlag.REFERENCED
        ? child.flags & DynamicFlag.INSERT
          ? child.anchor
          : child.id
        : undefined

    if (id === undefined && !child.hasDynamicChild) {
      push(...genSelf(child, context))
      continue
    }

    const elementIndex = index + offset
    const logicalIndex = elementIndex - ifBranchCount + prependCount
    // p for "placeholder" variables that are meant for possible reuse by
    // other access paths
    const variable = id === undefined ? `p${context.block.tempId++}` : `n${id}`
    pushBlock(NEWLINE, `const ${variable} = `)
    if (prev) {
      if (elementIndex - prev[1] === 1) {
        pushBlock(...genCall(helper('next'), prev[0], String(logicalIndex)))
      } else {
        pushBlock(
          ...genCall(
            helper('nthChild'),
            from,
            String(elementIndex),
            String(logicalIndex),
          ),
        )
      }
    } else {
      if (elementIndex === 0) {
        pushBlock(...genCall(helper('child'), from, String(logicalIndex)))
      } else {
        pushBlock(
          ...genCall(
            helper('nthChild'),
            from,
            String(elementIndex),
            String(logicalIndex),
          ),
        )
      }
    }

    if (id === child.anchor && !child.hasDynamicChild) {
      push(...genSelf(child, context))
    }

    if (id !== undefined) {
      push(...genDirectivesForElement(id, context))
    }

    prev = [variable, elementIndex]
    push(...genChildren(child, context, pushBlock, variable))
  }

  return frag
}
