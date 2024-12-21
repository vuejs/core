import { NOOP, extend, genPropsAccessExp, isGloballyAllowed } from '@vue/shared'
import {
  BindingTypes,
  NewlineType,
  type SimpleExpressionNode,
  type SourceLocation,
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
import { walk } from 'estree-walker'
import { type ParserOptions, parseExpression } from '@babel/parser'

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
  { options, helper, identifiers }: CodegenContext,
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
): DeclarationResult {
  // analyze variables
  const { seenVariable, variableToExpMap, expToVariableMap, seenIdentifier } =
    analyzeExpressions(expressions)

  // process repeated identifiers and member expressions
  // e.g., `foo[baz]` will be transformed into `foo_baz`
  const varDeclarations = processRepeatedVariables(
    context,
    seenVariable,
    variableToExpMap,
    expToVariableMap,
    seenIdentifier,
  )

  // process duplicate expressions after identifier and member expression handling.
  // e.g., `foo + bar` will be transformed into `foo_bar`
  const expDeclarations = processRepeatedExpressions(
    context,
    expressions,
    varDeclarations,
  )

  return genDeclarations([...varDeclarations, ...expDeclarations], context)
}

function analyzeExpressions(expressions: SimpleExpressionNode[]) {
  const seenVariable: Record<string, number> = Object.create(null)
  const variableToExpMap = new Map<string, Set<SimpleExpressionNode>>()
  const expToVariableMap = new Map<SimpleExpressionNode, string[]>()
  const seenIdentifier = new Set<string>()

  const registerVariable = (
    name: string,
    exp: SimpleExpressionNode,
    isIdentifier: boolean,
  ) => {
    if (isIdentifier) seenIdentifier.add(name)
    seenVariable[name] = (seenVariable[name] || 0) + 1
    variableToExpMap.set(
      name,
      (variableToExpMap.get(name) || new Set()).add(exp),
    )
    expToVariableMap.set(exp, (expToVariableMap.get(exp) || []).concat(name))
  }

  for (const exp of expressions) {
    if (!exp.ast) {
      exp.ast === null && registerVariable(exp.content, exp, true)
      continue
    }

    walk(exp.ast, {
      enter(currentNode: Node) {
        if (currentNode.type === 'MemberExpression') {
          const memberExp = extractMemberExpression(
            currentNode,
            (name: string) => {
              registerVariable(name, exp, true)
            },
          )
          registerVariable(memberExp, exp, false)
          return this.skip()
        }

        if (currentNode.type === 'Identifier') {
          registerVariable(currentNode.name, exp, true)
        }
      },
    })
  }

  return { seenVariable, seenIdentifier, variableToExpMap, expToVariableMap }
}

function processRepeatedVariables(
  context: CodegenContext,
  seenVariable: Record<string, number>,
  variableToExpMap: Map<string, Set<SimpleExpressionNode>>,
  expToVariableMap: Map<SimpleExpressionNode, string[]>,
  seenIdentifier: Set<string>,
): DeclarationValue[] {
  const declarations: DeclarationValue[] = []
  for (const [name, exps] of variableToExpMap) {
    if (seenVariable[name] > 1 && exps.size > 0) {
      const isIdentifier = seenIdentifier.has(name)
      const varName = isIdentifier ? name : genVarName(name)

      // replaces all non-identifiers with the new name. if node content
      // includes only one member expression, it will become an identifier,
      // e.g., foo[baz] -> foo_baz.
      // for identifiers, we don't need to replace the content - they will be
      // replaced during context.withId(..., ids)
      const replaceRE = new RegExp(escapeRegExp(name), 'g')
      exps.forEach(node => {
        if (node.ast) {
          node.content = node.content.replace(replaceRE, varName)
          // re-parse the expression
          node.ast = parseExp(context, node.content)
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

  return declarations
}

function shouldDeclareVariable(
  name: string,
  expToVariableMap: Map<SimpleExpressionNode, string[]>,
  exps: Set<SimpleExpressionNode>,
): boolean {
  const vars = Array.from(exps, exp => expToVariableMap.get(exp)!)
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
): DeclarationValue[] {
  const declarations: DeclarationValue[] = []
  const seenExp = expressions.reduce(
    (acc, exp) => {
      // only handle expressions that are not identifiers
      if (exp.ast && exp.ast.type !== 'Identifier') {
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
): DeclarationResult {
  const [frag, push] = buildCodeFragment()
  const ids: Record<string, string> = Object.create(null)

  // process identifiers first as expressions may rely on them
  declarations.forEach(({ name, isIdentifier, value }) => {
    if (isIdentifier) {
      const varName = (ids[name] = `_${name}`)
      push(`const ${varName} = `, ...genExpression(value, context), NEWLINE)
    }
  })

  // process expressions
  declarations.forEach(({ name, isIdentifier, value }) => {
    if (!isIdentifier) {
      const varName = (ids[name] = `_${name}`)
      push(
        `const ${varName} = `,
        ...context.withId(() => genExpression(value, context), ids),
        NEWLINE,
      )
    }
  })

  return { ids, frag }
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

function genVarName(exp: string): string {
  return `${exp
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/_+$/, '')}`
}

function extractMemberExpression(
  exp: Node,
  onIdentifier: (name: string) => void,
): string {
  if (!exp) return ''
  switch (exp.type) {
    case 'Identifier': // foo[bar]
      onIdentifier(exp.name)
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
      const object = extractMemberExpression(exp.object, onIdentifier)
      const prop = exp.computed
        ? `[${extractMemberExpression(exp.property, onIdentifier)}]`
        : `.${extractMemberExpression(exp.property, NOOP)}`
      return `${object}${prop}`
    default:
      return ''
  }
}
