import type { CodegenContext } from '../generate'
import {
  DynamicAccess,
  type IRDynamicAccess,
  type IRDynamicInfo,
  IRNodeTypes,
  type IRTemplate,
} from '../ir'
import { TemplateFlags } from '@vue/shared'
import { genInsertionState, genOperationWithInsertionState } from './operation'
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
    if (
      operation &&
      operation.type === IRNodeTypes.INSERT_NODE &&
      operation.appendIndex !== undefined
    ) {
      push(genInsertionState(operation, context))
    }
    push(NEWLINE, `const n${id} = ${context.tName(template)}()`)
  }

  if (operation) {
    push(genOperationWithInsertionState(operation, context))
  }

  if (hasDynamicChild) {
    push(genChildren(dynamic, context, push, `n${id}`, flushBeforeDynamic))
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
  // the variable of the previous access: adjacent lookups chain off it and
  // placeholders may reassign it
  let prev: string | undefined

  for (const child of dynamic.children) {
    const { access } = child
    if (!access) {
      flushBeforeDynamic && flushBeforeDynamic(child, push)
      push(genSelf(child, context, flushBeforeDynamic))
      continue
    }

    const accessPath = genAccessPath(context, from, access, prev, child.isText)
    switch (access.kind) {
      case DynamicAccess.INLINE:
        push(
          genChildren(
            child,
            context,
            pushBlock,
            accessPath,
            flushBeforeDynamic,
          ),
        )
        continue
      case DynamicAccess.INLINE_REUSE:
        push(
          genChildren(
            child,
            context,
            pushBlock,
            ['(', prev!, ' = ', accessPath, ')'],
            flushBeforeDynamic,
          ),
        )
        continue
      case DynamicAccess.REUSE:
        pushBlock(NEWLINE, `${prev} = `, accessPath)
        break
      case DynamicAccess.PLACEHOLDER:
        // p for "placeholder" variables that are meant for possible reuse by
        // other access paths
        prev = context.pName(context.block.tempId++)
        pushBlock(NEWLINE, `let ${prev} = `, accessPath)
        break
      case DynamicAccess.REFERENCE:
        prev = `n${access.id}`
        pushBlock(NEWLINE, `const ${prev} = `, accessPath)
    }

    if (child.operation) {
      // created by its own operation (block, component, inserted template):
      // the access located its anchor, genSelf owns the subtree
      flushBeforeDynamic && flushBeforeDynamic(child, push)
      push(genSelf(child, context, flushBeforeDynamic))
    } else if (child.hasDynamicChild) {
      push(genChildren(child, context, pushBlock, prev, flushBeforeDynamic))
    }
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
  { index, adjacent }: IRDynamicAccess,
  prev: string | undefined,
  isText?: boolean,
): CodeFragment[] {
  const textHint = isText ? 'true' : undefined
  if (adjacent) {
    return genCall(helper('next'), prev!, textHint)
  }

  if (index === 0) {
    return genCall(helper('child'), from, textHint)
  }

  // adjacent to the first child: chain off it instead of an indexed lookup
  if (index === 1) {
    const firstChild = genCall(helper('child'), from)
    return genCall(helper('next'), firstChild, textHint)
  }
  return genCall(helper('nthChild'), from, String(index), textHint)
}
