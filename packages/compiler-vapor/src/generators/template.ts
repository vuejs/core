import type { CodegenContext } from '../generate'
import { DynamicFlag, type IRDynamicInfo } from '../ir'
import { genDirectivesForElement } from './directive'
import { genOperationWithInsertionState } from './operation'
import { type CodeFragment, NEWLINE, buildCodeFragment, genCall } from './utils'

export function genTemplates(
  templates: Map<string, number>,
  rootIndex: number | undefined,
  { helper }: CodegenContext,
): string {
  const result: string[] = []
  let i = 0
  templates.forEach((ns, template) => {
    result.push(
      `const t${i} = ${helper('template')}(${JSON.stringify(
        template,
      )}${i === rootIndex ? ', true' : ns ? ', false' : ''}${ns ? `, ${ns}` : ''})\n`,
    )
    i++
  })
  return result.join('')
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
  pushBlock: (...items: CodeFragment[]) => number,
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
    pushBlock(NEWLINE, `const ${variable} = `)

    if (prev) {
      if (elementIndex - prev[1] === 1) {
        pushBlock(...genCall(helper('next'), prev[0]))
      } else {
        pushBlock(...genCall(helper('nthChild'), from, String(elementIndex)))
      }
    } else {
      if (elementIndex === 0) {
        pushBlock(...genCall(helper('child'), from))
      } else {
        // check if there's a node that we can reuse from
        let init = genCall(helper('child'), from)
        if (elementIndex === 1) {
          init = genCall(helper('next'), init)
        } else if (elementIndex > 1) {
          init = genCall(helper('nthChild'), from, String(elementIndex))
        }
        pushBlock(...init)
      }
    }

    if (id === child.anchor) {
      push(...genSelf(child, context))
    }

    if (id !== undefined) {
      push(...genDirectivesForElement(id, context))
    }

    prev = [variable, elementIndex]
    childrenToGen.push([child, variable])
  }

  if (childrenToGen.length) {
    for (const [child, from] of childrenToGen) {
      push(...genChildren(child, context, pushBlock, from))
    }
  }

  return frag
}
