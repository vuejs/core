import type { CodegenContext } from '../generate'
import { DynamicFlag, type IRDynamicInfo } from '../ir'
import { genDirectivesForElement } from './directive'
import { type CodeFragment, NEWLINE, buildCodeFragment, genCall } from './utils'

export function genTemplates(
  templates: string[],
  { vaporHelper }: CodegenContext,
): string {
  return templates
    .map(
      (template, i) =>
        `const t${i} = ${vaporHelper('template')}(${JSON.stringify(template)})\n`,
    )
    .join('')
}

export function genChildren(
  dynamic: IRDynamicInfo,
  context: CodegenContext,
  from: number,
  paths: number[] = [],
): CodeFragment[] {
  const { vaporHelper } = context
  const [frag, push] = buildCodeFragment()
  let offset = 0
  const { children, id, template } = dynamic

  if (id !== undefined && template !== undefined) {
    push(NEWLINE, `const n${id} = t${template}()`)
    push(...genDirectivesForElement(id, context))
  }

  let prev: [id: number, elementIndex: number] | undefined
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

    const elementIndex = Number(index) + offset
    const newPaths = [...paths, elementIndex]

    if (id === undefined) {
      push(...genChildren(child, context, from, newPaths))
      continue
    }

    push(NEWLINE, `const n${id} = `)
    if (prev) {
      const offset = elementIndex - prev[1]
      if (offset === 1) {
        push(`n${prev[0]}.nextSibling`)
      } else {
        push(...genCall(vaporHelper('next'), `n${prev[0]}`, String(offset)))
      }
    } else {
      if (newPaths.length === 1 && newPaths[0] === 0) {
        push(`n${from}.firstChild`)
      } else {
        push(
          ...genCall(
            vaporHelper('children'),
            `n${from}`,
            ...newPaths.map(String),
          ),
        )
      }
    }
    push(...genDirectivesForElement(id, context))
    prev = [id, elementIndex]
    push(...genChildren(child, context, id, []))
  }

  return frag
}
