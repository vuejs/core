import type { CodegenContext } from '../generate'
import { DynamicFlag, type IRDynamicInfo } from '../ir'
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
  const { id, template, operation } = dynamic

  if (id !== undefined && template !== undefined) {
    push(NEWLINE, `const n${id} = t${template}()`)
    push(...genDirectivesForElement(id, context))
  }

  if (operation) {
    push(...genOperationWithInsertionState(operation, context))
  }

  return frag
}

export function genChildren(
  dynamic: IRDynamicInfo,
  context: CodegenContext,
  from: string = `n${dynamic.id}`,
): CodeFragment[] {
  const { helper } = context
  const [frag, push] = buildCodeFragment()
  const { children } = dynamic

  let offset = 0
  let prev: [variable: string, elementIndex: number] | undefined
  const childrenToGen: [IRDynamicInfo, string][] = []

  for (const [index, child] of children.entries()) {
    if (child.flags & DynamicFlag.NON_TEMPLATE) {
      offset--
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

    const elementIndex = Number(index) + offset
    // p for "placeholder" variables that are meant for possible reuse by
    // other access paths
    const variable = id === undefined ? `p${context.block.tempId++}` : `n${id}`
    push(NEWLINE, `const ${variable} = `)

    if (prev) {
      if (elementIndex - prev[1] === 1) {
        push(...genCall(helper('next'), prev[0]))
      } else {
        push(...genCall(helper('nthChild'), from, String(elementIndex)))
      }
    } else {
      if (elementIndex === 0) {
        push(...genCall(helper('child'), from))
      } else {
        // check if there's a node that we can reuse from
        let init = genCall(helper('child'), from)
        if (elementIndex === 1) {
          init = genCall(helper('next'), init)
        } else if (elementIndex > 1) {
          init = genCall(helper('nthChild'), from, String(elementIndex))
        }
        push(...init)
      }
    }
    if (id !== undefined) {
      push(...genDirectivesForElement(id, context))
    }
    prev = [variable, elementIndex]
    childrenToGen.push([child, variable])
  }

  for (const [child, from] of childrenToGen) {
    push(...genChildren(child, context, from))
  }

  return frag
}
