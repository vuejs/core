import type { CodegenContext } from '../generate'
import { DynamicFlag, type IRDynamicInfo } from '../ir'
import { genDirectivesForElement } from './directive'
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

export function genChildren(
  dynamic: IRDynamicInfo,
  context: CodegenContext,
  from: string,
  path: number[] = [],
  knownPaths: [id: string, path: number[]][] = [],
): CodeFragment[] {
  const { helper } = context
  const [frag, push] = buildCodeFragment()
  let offset = 0
  const { children, id, template } = dynamic

  if (id !== undefined && template !== undefined) {
    push(NEWLINE, `const n${id} = t${template}()`)
    push(...genDirectivesForElement(id, context))
  }

  let prev: [variable: string, elementIndex: number] | undefined
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
      const { id, template } = child
      if (id !== undefined && template !== undefined) {
        push(NEWLINE, `const n${id} = t${template}()`)
        push(...genDirectivesForElement(id, context))
      }
      continue
    }

    const elementIndex = Number(index) + offset
    const newPath = [...path, elementIndex]

    // p for "placeholder" variables that are meant for possible reuse by
    // other access paths
    const variable = id === undefined ? `p${context.block.tempId++}` : `n${id}`
    push(NEWLINE, `const ${variable} = `)

    if (prev) {
      const offset = elementIndex - prev[1]
      if (offset === 1) {
        push(...genCall(helper('next'), prev[0]))
      } else {
        push(...genCall(helper('nthChild'), from, String(offset)))
      }
    } else {
      if (newPath.length === 1 && newPath[0] === 0) {
        push(...genCall(helper('child'), from))
      } else {
        // check if there's a node that we can reuse from
        let resolvedFrom = from
        let resolvedPath = newPath
        let skipFirstChild = false
        outer: for (const [from, path] of knownPaths) {
          const l = path.length
          const tail = newPath.slice(l)
          for (let i = 0; i < l; i++) {
            const parentSeg = path[i]
            const thisSeg = newPath[i]
            if (parentSeg !== thisSeg) {
              if (i === l - 1) {
                // last bit is reusable
                resolvedFrom = from
                resolvedPath = [thisSeg - parentSeg, ...tail]
                skipFirstChild = true
                break outer
              }
              break
            } else if (i === l - 1) {
              // full overlap
              resolvedFrom = from
              resolvedPath = tail
              break outer
            }
          }
        }
        let init
        for (const i of resolvedPath) {
          init = init
            ? genCall(helper('child'), init)
            : skipFirstChild
              ? resolvedFrom
              : genCall(helper('child'), resolvedFrom)
          if (i === 1) {
            init = genCall(helper('next'), init)
          } else if (i > 1) {
            init = genCall(helper('nthChild'), resolvedFrom, String(i))
          }
        }
        push(...init!)
      }
    }
    if (id !== undefined) {
      push(...genDirectivesForElement(id, context))
    }
    knownPaths.unshift([variable, newPath])
    prev = [variable, elementIndex]
    push(...genChildren(child, context, variable))
  }

  return frag
}
