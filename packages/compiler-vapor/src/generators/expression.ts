import {
  NOOP,
  extend,
  genPropsAccessExp,
  isGloballyAllowed,
  isString,
} from '@vue/shared'
import {
  BindingTypes,
  NewlineType,
  type SimpleExpressionNode,
  type SourceLocation,
  TS_NODE_TYPES,
  advancePositionWithClone,
  createSimpleExpression,
  isInDestructureAssignment,
  isStaticProperty,
  walkIdentifiers,
} from '@vue/compiler-dom'
import type { Identifier, Node } from '@babel/types'
import type { CodegenContext } from '../generate'
import { isConstantExpression } from '../utils'
import { type CodeFragment, NEWLINE, buildCodeFragment } from './utils'
import { type ParserOptions, parseExpression } from '@babel/parser'

export function genExpression(
  node: SimpleExpressionNode,
  context: CodegenContext,
  assignment?: string,
): CodeFragment[] {
  const { content, ast, isStatic, loc } = node

  if (isStatic) {
    return [[JSON.stringify(content), NewlineType.None, loc]]
  }

  if (
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
    const isTSNode = ast && TS_NODE_TYPES.includes(ast.type)
    ids
      .sort((a, b) => a.start! - b.start!)
      .forEach((id, i) => {
        // range is offset by -1 due to the wrapping parens when parsed
        const start = id.start! - 1
        const end = id.end! - 1
        const last = ids[i - 1]

        if (!(isTSNode && i === 0)) {
          const leadingText = content.slice(last ? last.end! - 1 : 0, start)
          if (leadingText.length) push([leadingText, NewlineType.Unknown])
        }

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

        if (i === ids.length - 1 && end < content.length && !isTSNode) {
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
  context: CodegenContext,
  loc?: SourceLocation,
  assignment?: string,
  id?: Identifier,
  parent?: Node,
  parentStack?: Node[],
): CodeFragment[] {
  const { options, helper, identifiers } = context
  const { inline, bindingMetadata } = options
  let name: string | undefined = raw

  const idMap = identifiers[raw]
  if (idMap && idMap.length) {
    const replacement = idMap[0]
    if (isString(replacement)) {
      if (parent && parent.type === 'ObjectProperty' && parent.shorthand) {
        return [[`${name}: ${replacement}`, NewlineType.None, loc]]
      } else {
        return [[replacement, NewlineType.None, loc]]
      }
    } else {
      // replacement is an expression - process it again
      return genExpression(replacement, context, assignment)
    }
  }

  let prefix: string | undefined
  if (isStaticProperty(parent) && parent.shorthand) {
    // property shorthand like { foo }, we need to add the key since
    // we rewrite the value
    prefix = `${raw}: `
  }

  const type = bindingMetadata && bindingMetadata[raw]
  if (inline) {
    switch (type) {
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
              ? `${helper('isRef')}(${raw}) ? (${raw}.value = ${assignment}) : null`
              : unref()
        break
      case BindingTypes.PROPS:
        raw = genPropsAccessExp(raw)
        break
      case BindingTypes.PROPS_ALIASED:
        raw = genPropsAccessExp(bindingMetadata.__propsAliases![raw])
        break
      default:
        raw = withAssignment(raw)
    }
  } else {
    if (canPrefix(raw)) {
      if (type === BindingTypes.PROPS_ALIASED) {
        raw = `$props['${bindingMetadata.__propsAliases![raw]}']`
      } else {
        raw = `${type === BindingTypes.PROPS ? '$props' : '_ctx'}.${raw}`
      }
    }
    raw = withAssignment(raw)
  }
  return [prefix, [raw, NewlineType.None, loc, name]]

  function withAssignment(s: string) {
    return assignment ? `${s} = ${assignment}` : s
  }
  function unref() {
    return `${helper('unref')}(${raw})`
  }
}

function canPrefix(name: string) {
  // skip whitelisted globals
  if (isGloballyAllowed(name)) {
    return false
  }
  if (
    // special case for webpack compilation
    name === 'require' ||
    name === '$props' ||
    name === '$emit' ||
    name === '$attrs' ||
    name === '$slots'
  )
    return false
  return true
}

type DeclarationResult = {
  ids: Record<string, string>
  frag: CodeFragment[]
  varNames: string[]
}
type DeclarationValue = {
  name: string
  isIdentifier?: boolean
  value: SimpleExpressionNode
  rawName?: string
  exps?: Set<SimpleExpressionNode>
  seenCount?: number
}

export function processExpressions(
  context: CodegenContext,
  expressions: SimpleExpressionNode[],
  shouldDeclare: boolean,
): DeclarationResult {
  // analyze variables
  const {
    seenVariable,
    variableToExpMap,
    expToVariableMap,
    seenIdentifier,
    updatedVariable,
  } = analyzeExpressions(expressions)

  // process repeated identifiers and member expressions
  // e.g., `foo[baz]` will be transformed into `foo_baz`
  const varDeclarations = processRepeatedVariables(
    context,
    seenVariable,
    variableToExpMap,
    expToVariableMap,
    seenIdentifier,
    updatedVariable,
  )

  // process duplicate expressions after identifier and member expression handling.
  // e.g., `foo + bar` will be transformed into `foo_bar`
  const expDeclarations = processRepeatedExpressions(
    context,
    expressions,
    varDeclarations,
    updatedVariable,
    expToVariableMap,
  )

  return genDeclarations(
    [...varDeclarations, ...expDeclarations],
    context,
    shouldDeclare,
  )
}

function analyzeExpressions(expressions: SimpleExpressionNode[]) {
  const seenVariable: Record<string, number> = Object.create(null)
  const variableToExpMap = new Map<string, Set<SimpleExpressionNode>>()
  const expToVariableMap = new Map<
    SimpleExpressionNode,
    Array<{
      name: string
      loc?: { start: number; end: number }
    }>
  >()
  const seenIdentifier = new Set<string>()
  const updatedVariable = new Set<string>()

  const registerVariable = (
    name: string,
    exp: SimpleExpressionNode,
    isIdentifier: boolean,
    loc?: { start: number; end: number },
    parentStack: Node[] = [],
  ) => {
    if (isIdentifier) seenIdentifier.add(name)
    seenVariable[name] = (seenVariable[name] || 0) + 1
    variableToExpMap.set(
      name,
      (variableToExpMap.get(name) || new Set()).add(exp),
    )

    const variables = expToVariableMap.get(exp) || []
    variables.push({ name, loc })
    expToVariableMap.set(exp, variables)

    if (
      parentStack.some(
        p => p.type === 'UpdateExpression' || p.type === 'AssignmentExpression',
      )
    ) {
      updatedVariable.add(name)
    }
  }

  for (const exp of expressions) {
    if (!exp.ast) {
      exp.ast === null && registerVariable(exp.content, exp, true)
      continue
    }

    walkIdentifiers(exp.ast, (currentNode, parent, parentStack) => {
      if (parent && isMemberExpression(parent)) {
        const memberExp = extractMemberExpression(parent, id => {
          registerVariable(id.name, exp, true, {
            start: id.start!,
            end: id.end!,
          })
        })
        registerVariable(
          memberExp,
          exp,
          false,
          { start: parent.start!, end: parent.end! },
          parentStack,
        )
      } else if (!parentStack.some(isMemberExpression)) {
        registerVariable(
          currentNode.name,
          exp,
          true,
          { start: currentNode.start!, end: currentNode.end! },
          parentStack,
        )
      }
    })
  }

  return {
    seenVariable,
    seenIdentifier,
    variableToExpMap,
    expToVariableMap,
    updatedVariable,
  }
}

function processRepeatedVariables(
  context: CodegenContext,
  seenVariable: Record<string, number>,
  variableToExpMap: Map<string, Set<SimpleExpressionNode>>,
  expToVariableMap: Map<
    SimpleExpressionNode,
    Array<{ name: string; loc?: { start: number; end: number } }>
  >,
  seenIdentifier: Set<string>,
  updatedVariable: Set<string>,
): DeclarationValue[] {
  const declarations: DeclarationValue[] = []
  const expToReplacementMap = new Map<
    SimpleExpressionNode,
    Array<{
      name: string
      locs: { start: number; end: number }[]
    }>
  >()

  for (const [name, exps] of variableToExpMap) {
    if (updatedVariable.has(name)) continue
    if (seenVariable[name] > 1 && exps.size > 0) {
      const isIdentifier = seenIdentifier.has(name)
      const varName = isIdentifier ? name : genVarName(name)

      // replaces all non-identifiers with the new name. if node content
      // includes only one member expression, it will become an identifier,
      // e.g., foo[baz] -> foo_baz.
      // for identifiers, we don't need to replace the content - they will be
      // replaced during context.withId(..., ids)
      exps.forEach(node => {
        if (node.ast && varName !== name) {
          const replacements = expToReplacementMap.get(node) || []
          replacements.push({
            name: varName,
            locs: expToVariableMap.get(node)!.reduce(
              (locs, v) => {
                if (v.name === name && v.loc) locs.push(v.loc)
                return locs
              },
              [] as { start: number; end: number }[],
            ),
          })
          expToReplacementMap.set(node, replacements)
        }
      })

      if (
        !declarations.some(d => d.name === varName) &&
        (!isIdentifier || shouldDeclareVariable(name, expToVariableMap, exps))
      ) {
        declarations.push({
          name: varName,
          isIdentifier,
          value: extend(
            { ast: isIdentifier ? null : parseExp(context, name) },
            createSimpleExpression(name),
          ),
          rawName: name,
          exps,
          seenCount: seenVariable[name],
        })
      }
    }
  }

  for (const [exp, replacements] of expToReplacementMap) {
    replacements
      .flatMap(({ name, locs }) =>
        locs.map(({ start, end }) => ({ start, end, name })),
      )
      .sort((a, b) => b.end - a.end)
      .forEach(({ start, end, name }) => {
        exp.content =
          exp.content.slice(0, start - 1) + name + exp.content.slice(end - 1)
      })

    // re-parse the expression
    exp.ast = parseExp(context, exp.content)
  }

  return declarations
}

function shouldDeclareVariable(
  name: string,
  expToVariableMap: Map<
    SimpleExpressionNode,
    Array<{ name: string; loc?: { start: number; end: number } }>
  >,
  exps: Set<SimpleExpressionNode>,
): boolean {
  const vars = Array.from(exps, exp =>
    expToVariableMap.get(exp)!.map(v => v.name),
  )
  // assume name equals to `foo`
  // if each expression only references `foo`, declaration is needed
  // to avoid reactivity tracking
  // e.g., [[foo],[foo]]
  if (vars.every(v => v.length === 1)) {
    return true
  }

  // if `foo` appears multiple times in one array, declaration is needed
  // e.g., [[foo,foo]]
  if (vars.some(v => v.filter(e => e === name).length > 1)) {
    return true
  }

  const first = vars[0]
  // if arrays have different lengths, declaration is needed
  // e.g., [[foo],[foo,bar]]
  if (vars.some(v => v.length !== first.length)) {
    // special case, no declaration needed if one array is a subset of the other
    // because they will be treated as repeated expressions
    // e.g., [[foo,bar],[foo,foo,bar]] -> const foo_bar = _ctx.foo + _ctx.bar
    if (
      vars.some(
        v => v.length > first.length && v.every(e => first.includes(e)),
      ) ||
      vars.some(v => first.length > v.length && first.every(e => v.includes(e)))
    ) {
      return false
    }
    return true
  }
  // if arrays share common elements, no declaration needed
  // because they will be treat as repeated expressions
  // e.g., [[foo,bar],[foo,bar]] -> const foo_bar = _ctx.foo + _ctx.bar
  if (vars.some(v => v.some(e => first.includes(e)))) {
    return false
  }

  return true
}

function processRepeatedExpressions(
  context: CodegenContext,
  expressions: SimpleExpressionNode[],
  varDeclarations: DeclarationValue[],
  updatedVariable: Set<string>,
  expToVariableMap: Map<
    SimpleExpressionNode,
    Array<{ name: string; loc?: { start: number; end: number } }>
  >,
): DeclarationValue[] {
  const declarations: DeclarationValue[] = []
  const seenExp = expressions.reduce(
    (acc, exp) => {
      const variables = expToVariableMap.get(exp)!.map(v => v.name)
      // only handle expressions that are not identifiers
      if (
        exp.ast &&
        exp.ast.type !== 'Identifier' &&
        !(variables && variables.some(v => updatedVariable.has(v)))
      ) {
        acc[exp.content] = (acc[exp.content] || 0) + 1
      }
      return acc
    },
    Object.create(null) as Record<string, number>,
  )

  Object.entries(seenExp).forEach(([content, count]) => {
    if (count > 1) {
      // foo + baz -> foo_baz
      const varName = genVarName(content)
      if (!declarations.some(d => d.name === varName)) {
        // if foo and baz have no other references, we don't need to declare separate variables
        // instead of:
        // const foo = _ctx.foo
        // const baz = _ctx.baz
        // const foo_baz = foo + baz
        // we can generate:
        // const foo_baz = _ctx.foo + _ctx.baz
        const delVars: Record<string, string> = {}
        for (let i = varDeclarations.length - 1; i >= 0; i--) {
          const item = varDeclarations[i]
          if (!item.exps || !item.seenCount) continue

          const shouldRemove = [...item.exps].every(
            node => node.content === content && item.seenCount === count,
          )
          if (shouldRemove) {
            delVars[item.name] = item.rawName!
            varDeclarations.splice(i, 1)
          }
        }
        const value = extend(
          {},
          expressions.find(exp => exp.content === content)!,
        )
        Object.keys(delVars).forEach(name => {
          value.content = value.content.replace(name, delVars[name])
          if (value.ast) value.ast = parseExp(context, value.content)
        })
        declarations.push({
          name: varName,
          value: value,
        })
      }

      // assume content equals to `foo + baz`
      expressions.forEach(exp => {
        // foo + baz -> foo_baz
        if (exp.content === content) {
          exp.content = varName
          // ast is no longer needed since it becomes an identifier.
          exp.ast = null
        }
        // foo + foo + baz -> foo + foo_baz
        else if (exp.content.includes(content)) {
          exp.content = exp.content.replace(
            new RegExp(escapeRegExp(content), 'g'),
            varName,
          )
          // re-parse the expression
          exp.ast = parseExp(context, exp.content)
        }
      })
    }
  })

  return declarations
}

function genDeclarations(
  declarations: DeclarationValue[],
  context: CodegenContext,
  shouldDeclare: boolean,
): DeclarationResult {
  const [frag, push] = buildCodeFragment()
  const ids: Record<string, string> = Object.create(null)
  const varNames = new Set<string>()

  // process identifiers first as expressions may rely on them
  declarations.forEach(({ name, isIdentifier, value }) => {
    if (isIdentifier) {
      const varName = (ids[name] = `_${name}`)
      varNames.add(varName)
      if (shouldDeclare) {
        push(`const `)
      }
      push(`${varName} = `, ...genExpression(value, context), NEWLINE)
    }
  })

  // process expressions
  declarations.forEach(({ name, isIdentifier, value }) => {
    if (!isIdentifier) {
      const varName = (ids[name] = `_${name}`)
      varNames.add(varName)
      if (shouldDeclare) {
        push(`const `)
      }
      push(
        `${varName} = `,
        ...context.withId(() => genExpression(value, context), ids),
        NEWLINE,
      )
    }
  })

  return { ids, frag, varNames: [...varNames] }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseExp(context: CodegenContext, content: string): Node {
  const plugins = context.options.expressionPlugins
  const options: ParserOptions = {
    plugins: plugins ? [...plugins, 'typescript'] : ['typescript'],
  }
  return parseExpression(`(${content})`, options)
}

export function genVarName(exp: string): string {
  return `${exp
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/_+$/, '')}`
}

function extractMemberExpression(
  exp: Node,
  onIdentifier: (id: Identifier) => void,
): string {
  if (!exp) return ''
  switch (exp.type) {
    case 'Identifier': // foo[bar]
      onIdentifier(exp)
      return exp.name
    case 'StringLiteral': // foo['bar']
      return exp.extra ? (exp.extra.raw as string) : exp.value
    case 'NumericLiteral': // foo[0]
      return exp.value.toString()
    case 'BinaryExpression': // foo[bar + 1]
      return `${extractMemberExpression(exp.left, onIdentifier)} ${exp.operator} ${extractMemberExpression(exp.right, onIdentifier)}`
    case 'CallExpression': // foo[bar(baz)]
      return `${extractMemberExpression(exp.callee, onIdentifier)}(${exp.arguments.map(arg => extractMemberExpression(arg, onIdentifier)).join(', ')})`
    case 'MemberExpression': // foo[bar.baz]
    case 'OptionalMemberExpression': // foo?.bar
      const object = extractMemberExpression(exp.object, onIdentifier)
      const prop = exp.computed
        ? `[${extractMemberExpression(exp.property, onIdentifier)}]`
        : `.${extractMemberExpression(exp.property, NOOP)}`
      return `${object}${prop}`
    default:
      return ''
  }
}

const isMemberExpression = (node: Node) => {
  return (
    node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression'
  )
}
