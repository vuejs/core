import type { CodegenContext } from '../generate'
import { DynamicFlag, type IRDynamicInfo, type IRTemplate } from '../ir'
import { TemplateFlags } from '@vue/shared'
import { genDirectivesForElement } from './directive'
import { genOperationWithInsertionState } from './operation'
import {
  type CodeFragment,
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
  from: string = `n${dynamic.id}`,
  flushBeforeDynamic?: FlushBeforeDynamic,
): CodeFragment[] {
  const { helper } = context
  const [frag, push] = buildCodeFragment()
  const { children } = dynamic

  let offset = 0
  let prev: [variable: string, elementIndex: number] | undefined

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
    // p for "placeholder" variables that are meant for possible reuse by
    // other access paths
    const variable =
      id === undefined ? context.pName(context.block.tempId++) : `n${id}`
    pushBlock(NEWLINE, `const ${variable} = `)

    if (prev) {
      if (elementIndex - prev[1] === 1) {
        pushBlock(...genCall(helper('next'), prev[0], logicalIndex))
      } else {
        pushBlock(
          ...genCall(
            helper('nthChild'),
            from,
            String(elementIndex),
            logicalIndex,
          ),
        )
      }
    } else {
      if (elementIndex === 0) {
        pushBlock(
          ...genCall(
            helper('child'),
            from,
            child.logicalIndex !== 0 ? logicalIndex : undefined,
          ),
        )
      } else {
        // check if there's a node that we can reuse from
        let init = genCall(helper('child'), from)
        if (elementIndex === 1) {
          init = genCall(helper('next'), init, logicalIndex)
        } else if (elementIndex > 1) {
          init = genCall(
            helper('nthChild'),
            from,
            String(elementIndex),
            logicalIndex,
          )
        }
        pushBlock(...init)
      }
    }

    if (id === child.anchor && !child.hasDynamicChild) {
      flushBeforeDynamic && flushBeforeDynamic(child, push)
      push(...genSelf(child, context, flushBeforeDynamic))
    }

    if (id !== undefined) {
      push(...genDirectivesForElement(id, context))
    }

    prev = [variable, elementIndex]
    push(
      ...genChildren(child, context, pushBlock, variable, flushBeforeDynamic),
    )
  }

  return frag
}
