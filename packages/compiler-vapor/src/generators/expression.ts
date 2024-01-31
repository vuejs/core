import {
  BindingTypes,
  NewlineType,
  type SourceLocation,
  advancePositionWithClone,
  walkIdentifiers,
} from '@vue/compiler-dom'
import { isGloballyAllowed, isString, makeMap } from '@vue/shared'
import type { Identifier } from '@babel/types'
import type { IRExpression } from '../ir'
import {
  type CodeFragment,
  type CodegenContext,
  buildCodeFragment,
} from '../generate'

export function genExpression(
  node: IRExpression,
  context: CodegenContext,
  knownIds: Record<string, number> = Object.create(null),
): CodeFragment[] {
  const {
    options: { prefixIdentifiers },
  } = context
  if (isString(node)) return [node]

  const { content: rawExpr, ast, isStatic, loc } = node
  if (isStatic) {
    return [[JSON.stringify(rawExpr), NewlineType.None, loc]]
  }

  if (
    __BROWSER__ ||
    !prefixIdentifiers ||
    !node.content.trim() ||
    // there was a parsing error
    ast === false ||
    isGloballyAllowed(rawExpr) ||
    isLiteralWhitelisted(rawExpr)
  ) {
    return [[rawExpr, NewlineType.None, loc]]
  }

  if (ast === null) {
    // the expression is a simple identifier
    return [genIdentifier(rawExpr, context, loc)]
  }

  const ids: Identifier[] = []
  walkIdentifiers(
    ast!,
    (id, parent, parentStack, isReference, isLocal) => {
      if (isLocal) return
      ids.push(id)
    },
    false,
    [],
    knownIds,
  )
  if (ids.length) {
    ids.sort((a, b) => a.start! - b.start!)
    const [frag, push] = buildCodeFragment()
    ids.forEach((id, i) => {
      // range is offset by -1 due to the wrapping parens when parsed
      const start = id.start! - 1
      const end = id.end! - 1
      const last = ids[i - 1]

      const leadingText = rawExpr.slice(last ? last.end! - 1 : 0, start)
      if (leadingText.length) push([leadingText, NewlineType.Unknown])

      const source = rawExpr.slice(start, end)
      push(
        genIdentifier(source, context, {
          start: advancePositionWithClone(node.loc.start, source, start),
          end: advancePositionWithClone(node.loc.start, source, end),
          source,
        }),
      )

      if (i === ids.length - 1 && end < rawExpr.length) {
        push([rawExpr.slice(end), NewlineType.Unknown])
      }
    })
    return frag
  } else {
    return [[rawExpr, NewlineType.Unknown, loc]]
  }
}

const isLiteralWhitelisted = /*#__PURE__*/ makeMap('true,false,null,this')

function genIdentifier(
  id: string,
  { options, vaporHelper }: CodegenContext,
  loc?: SourceLocation,
): CodeFragment {
  const { inline, bindingMetadata } = options
  let name: string | undefined = id
  if (inline) {
    switch (bindingMetadata[id]) {
      case BindingTypes.SETUP_REF:
        name = id += '.value'
        break
      case BindingTypes.SETUP_MAYBE_REF:
        id = `${vaporHelper('unref')}(${id})`
        name = undefined
        break
    }
  } else {
    id = `_ctx.${id}`
  }
  return [id, NewlineType.None, loc, name]
}
