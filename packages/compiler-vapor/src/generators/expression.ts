import {
  BindingTypes,
  NewlineType,
  type SourceLocation,
  advancePositionWithClone,
  isInDestructureAssignment,
  isStaticProperty,
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
import type { Node } from '@babel/types'

export function genExpression(
  node: IRExpression,
  context: CodegenContext,
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

  // the expression is a simple identifier
  if (ast === null) {
    return genIdentifier(rawExpr, context, loc)
  }

  const ids: Identifier[] = []
  const parentStackMap = new WeakMap<Identifier, Node[]>()
  const parentStack: Node[] = []
  walkIdentifiers(
    ast!,
    id => {
      ids.push(id)
      parentStackMap.set(id, parentStack.slice())
    },
    false,
    parentStack,
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
      const parentStack = parentStackMap.get(id)!
      push(
        ...genIdentifier(
          source,
          context,
          {
            start: advancePositionWithClone(node.loc.start, source, start),
            end: advancePositionWithClone(node.loc.start, source, end),
            source,
          },
          id,
          parentStack[parentStack.length - 1],
          parentStack,
        ),
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
  raw: string,
  { options, vaporHelper, identifiers }: CodegenContext,
  loc?: SourceLocation,
  id?: Identifier,
  parent?: Node,
  parentStack?: Node[],
): CodeFragment[] {
  const { inline, bindingMetadata } = options
  let name: string | undefined = raw

  const idMap = identifiers[raw]
  if (idMap && idMap.length) {
    return [[idMap[0], NewlineType.None, loc]]
  }

  let prefix: string | undefined
  if (isStaticProperty(parent!) && parent.shorthand) {
    // property shorthand like { foo }, we need to add the key since
    // we rewrite the value
    prefix = `${raw}: `
  }

  if (inline) {
    switch (bindingMetadata[raw]) {
      case BindingTypes.SETUP_REF:
        name = raw = `${raw}.value`
        break
      case BindingTypes.SETUP_MAYBE_REF:
        // ({ x } = y)
        const isDestructureAssignment =
          parent && isInDestructureAssignment(parent, parentStack || [])
        // x = y
        const isAssignmentLVal =
          parent && parent.type === 'AssignmentExpression' && parent.left === id
        // x++
        const isUpdateArg =
          parent && parent.type === 'UpdateExpression' && parent.argument === id
        // const binding that may or may not be ref
        // if it's not a ref, then assignments don't make sense -
        // so we ignore the non-ref assignment case and generate code
        // that assumes the value to be a ref for more efficiency
        raw =
          isAssignmentLVal || isUpdateArg || isDestructureAssignment
            ? (name = `${raw}.value`)
            : `${vaporHelper('unref')}(${raw})`
        break
    }
  } else {
    raw = `_ctx.${raw}`
  }
  return [prefix, [raw, NewlineType.None, loc, name]]
}
