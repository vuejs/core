import { isGloballyAllowed } from '@vue/shared'
import {
  BindingTypes,
  NewlineType,
  type SimpleExpressionNode,
  type SourceLocation,
  advancePositionWithClone,
  isInDestructureAssignment,
  isStaticProperty,
  walkIdentifiers,
} from '@vue/compiler-dom'
import type { Identifier } from '@babel/types'
import type { CodegenContext } from '../generate'
import type { Node } from '@babel/types'
import { isConstantExpression } from '../utils'
import { type CodeFragment, buildCodeFragment } from './utils'

export function genExpression(
  node: SimpleExpressionNode,
  context: CodegenContext,
  assignment?: string,
): CodeFragment[] {
  const { prefixIdentifiers } = context.options
  const { content, ast, isStatic, loc } = node

  if (isStatic) {
    return [[JSON.stringify(content), NewlineType.None, loc]]
  }

  if (
    __BROWSER__ ||
    !prefixIdentifiers ||
    !node.content.trim() ||
    // there was a parsing error
    ast === false ||
    isConstantExpression(node)
  ) {
    return [[content, NewlineType.None, loc], assignment && ` = ${assignment}`]
  }

  // the expression is a simple identifier
  if (ast === null) {
    return genIdentifier(content, context, loc, assignment)
  }

  const ids: Identifier[] = []
  const parentStackMap = new Map<Identifier, Node[]>()
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

  let hasMemberExpression = false
  if (ids.length) {
    const [frag, push] = buildCodeFragment()
    ids
      .sort((a, b) => a.start! - b.start!)
      .forEach((id, i) => {
        // range is offset by -1 due to the wrapping parens when parsed
        const start = id.start! - 1
        const end = id.end! - 1
        const last = ids[i - 1]

        const leadingText = content.slice(last ? last.end! - 1 : 0, start)
        if (leadingText.length) push([leadingText, NewlineType.Unknown])

        const source = content.slice(start, end)
        const parentStack = parentStackMap.get(id)!
        const parent = parentStack[parentStack.length - 1]

        hasMemberExpression ||=
          parent &&
          (parent.type === 'MemberExpression' ||
            parent.type === 'OptionalMemberExpression')

        push(
          ...genIdentifier(
            source,
            context,
            {
              start: advancePositionWithClone(node.loc.start, source, start),
              end: advancePositionWithClone(node.loc.start, source, end),
              source,
            },
            hasMemberExpression ? undefined : assignment,
            id,
            parent,
            parentStack,
          ),
        )

        if (i === ids.length - 1 && end < content.length) {
          push([content.slice(end), NewlineType.Unknown])
        }
      })

    if (assignment && hasMemberExpression) {
      push(` = ${assignment}`)
    }
    return frag
  } else {
    return [[content, NewlineType.Unknown, loc]]
  }
}

function genIdentifier(
  raw: string,
  { options, vaporHelper, identifiers }: CodegenContext,
  loc?: SourceLocation,
  assignment?: string,
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
  if (isStaticProperty(parent) && parent.shorthand) {
    // property shorthand like { foo }, we need to add the key since
    // we rewrite the value
    prefix = `${raw}: `
  }

  if (inline) {
    switch (bindingMetadata[raw]) {
      case BindingTypes.SETUP_LET:
        name = raw = assignment
          ? `_isRef(${raw}) ? (${raw}.value = ${assignment}) : (${raw} = ${assignment})`
          : unref()
        break
      case BindingTypes.SETUP_REF:
        name = raw = withAssignment(`${raw}.value`)
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
            : assignment
              ? `${vaporHelper('isRef')}(${raw}) ? (${raw}.value = ${assignment}) : null`
              : unref()
        break
      default:
        raw = withAssignment(raw)
    }
  } else {
    raw = withAssignment(canPrefix(raw) ? `_ctx.${raw}` : raw)
  }
  return [prefix, [raw, NewlineType.None, loc, name]]

  function withAssignment(s: string) {
    return assignment ? `${s} = ${assignment}` : s
  }
  function unref() {
    return `${vaporHelper('unref')}(${raw})`
  }
}

function canPrefix(name: string) {
  // skip whitelisted globals
  if (isGloballyAllowed(name)) {
    return false
  }
  // special case for webpack compilation
  if (name === 'require') {
    return false
  }
  return true
}
