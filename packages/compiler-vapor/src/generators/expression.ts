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
  advancePositionWithClone,
  createSimpleExpression,
  isInDestructureAssignment,
  isStaticProperty,
  walkIdentifiers,
} from '@vue/compiler-dom'
import type {
  AssignmentExpression,
  Identifier,
  Node,
  UpdateExpression,
} from '@babel/types'
import type { CodegenContext } from '../generate'
import { isConstantExpression } from '../utils'
import {
  type CodeFragment,
  NEWLINE,
  buildCodeFragment,
  getParserOptions,
} from './utils'
import { parseExpression } from '@babel/parser'

export function genExpression(
  node: SimpleExpressionNode,
  context: CodegenContext,
  assignment?: string,
): CodeFragment[] {
  node = context.getExpressionReplacement(node)
  const { content, ast, isStatic, loc } = node
  const { options } = context
  const { inline } = options

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
    let lastEnd = 0
    ids
      .sort((a, b) => a.start! - b.start!)
      .forEach(id => {
        // range is offset by -1 due to the wrapping parens when parsed
        const idStart = id.start! - 1
        const idEnd = id.end! - 1
        const source = content.slice(idStart, idEnd)
        const parentStack = parentStackMap.get(id)!
        const parent = parentStack[parentStack.length - 1]
        let start = idStart
        let end = idEnd

        if (
          inline &&
          options.bindingMetadata &&
          options.bindingMetadata[source] === BindingTypes.SETUP_LET &&
          parent &&
          parent.type === 'UpdateExpression' &&
          parent.argument === id
        ) {
          start = parent.start! - 1
          end = parent.end! - 1
        }

        if (start < lastEnd) return

        const leadingText = content.slice(lastEnd, start)
        if (leadingText.length) push([leadingText, NewlineType.Unknown])

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
            node,
          ),
        )

        lastEnd = end
      })

    if (lastEnd < content.length) {
      push([content.slice(lastEnd), NewlineType.Unknown])
    }
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
  sourceNode?: SimpleExpressionNode,
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
  const type = bindingMetadata && bindingMetadata[raw]
  // ({ x } = y)
  const isDestructureAssignment =
    parent && isInDestructureAssignment(parent, parentStack || [])
  // x = y
  const isAssignmentLVal =
    parent && parent.type === 'AssignmentExpression' && parent.left === id
  // x++
  const isUpdateArg =
    parent && parent.type === 'UpdateExpression' && parent.argument === id

  if (
    isStaticProperty(parent) &&
    parent.shorthand &&
    !(inline && type === BindingTypes.SETUP_LET && isDestructureAssignment)
  ) {
    // property shorthand like { foo }, we need to add the key since
    // we rewrite the value
    prefix = `${raw}: `
  }

  if (inline) {
    switch (type) {
      case BindingTypes.SETUP_LET:
        if (isAssignmentLVal) {
          const { right, operator } = parent as AssignmentExpression
          const source = sourceNode!
          const sourceContent = source.content
          const rightStart = right.start! - 1
          const rightEnd = right.end! - 1
          const rightContent = sourceContent.slice(rightStart, rightEnd)
          const rightExp = createSimpleExpression(rightContent, false, {
            start: advancePositionWithClone(
              source.loc.start,
              sourceContent,
              rightStart,
            ),
            end: advancePositionWithClone(
              source.loc.start,
              sourceContent,
              rightEnd,
            ),
            source: rightContent,
          })
          rightExp.ast = parseExp(context, rightContent)
          return [
            prefix,
            `${helper('isRef')}(${raw}) ? ${raw}.value ${operator} `,
            ...genExpression(rightExp, context),
            ` : `,
            [raw, NewlineType.None, loc, name],
          ]
        } else if (isUpdateArg) {
          const { prefix: isPrefix, operator } = parent as UpdateExpression
          const updatePrefix = isPrefix ? operator : ``
          const updatePostfix = isPrefix ? `` : operator
          raw = `${helper('isRef')}(${raw}) ? ${updatePrefix}${raw}.value${updatePostfix} : ${updatePrefix}${raw}${updatePostfix}`
        } else if (!isDestructureAssignment) {
          name = raw = assignment
            ? `${helper('isRef')}(${raw}) ? (${raw}.value = ${assignment}) : (${raw} = ${assignment})`
            : unref()
        }
        break
      case BindingTypes.SETUP_REF:
        name = raw = withAssignment(`${raw}.value`)
        break
      case BindingTypes.SETUP_MAYBE_REF:
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

type ProcessedExpressionResult = {
  ids: Record<string, string>
  frag: CodeFragment[]
  varNames: string[]
  expressionReplacements: Map<SimpleExpressionNode, SimpleExpressionNode>
}
type DeclarationValue = {
  name: string
  isIdentifier?: boolean
  value: SimpleExpressionNode
  rawName?: string
  exps?: Set<SimpleExpressionNode>
  seenCount?: number
}
type SourceRange = {
  start: number
  end: number
}
type VariableUse = {
  name: string
  loc?: SourceRange
}
type ExpressionRecord = {
  variables: VariableUse[]
}
type ExpressionAnalysis = {
  seenVariable: Record<string, number>
  variableToExpMap: Map<string, Set<SimpleExpressionNode>>
  expressionRecords: Map<SimpleExpressionNode, ExpressionRecord>
  seenIdentifier: Set<string>
  updatedVariable: Set<string>
}
type SeenExpression = {
  count: number
  first: SimpleExpressionNode
}
type ContentReplacement = {
  start: number
  end: number
  content: string
}
type ReplacementPlan = Map<SimpleExpressionNode, ContentReplacement[]>

export function processExpressions(
  context: CodegenContext,
  expressions: SimpleExpressionNode[],
  shouldDeclare: boolean,
): ProcessedExpressionResult {
  const expressionReplacements = new Map<
    SimpleExpressionNode,
    SimpleExpressionNode
  >()
  // analyze variables
  const {
    seenVariable,
    variableToExpMap,
    expressionRecords,
    seenIdentifier,
    updatedVariable,
  } = analyzeExpressions(expressions)
  const reservedNames = new Set<string>(seenIdentifier)

  // process repeated identifiers and member expressions
  // e.g., `foo[baz]` will be transformed into `foo_baz`
  const varDeclarations = processRepeatedVariables(
    context,
    seenVariable,
    variableToExpMap,
    expressionRecords,
    seenIdentifier,
    updatedVariable,
    reservedNames,
    expressionReplacements,
  )

  // process duplicate expressions after identifier and member expression handling.
  // e.g., `foo + bar` will be transformed into `foo_bar`
  const expDeclarations = processRepeatedExpressions(
    context,
    expressions,
    varDeclarations,
    updatedVariable,
    expressionRecords,
    reservedNames,
    expressionReplacements,
  )

  return {
    ...genDeclarations(
      [...varDeclarations, ...expDeclarations],
      context,
      shouldDeclare,
    ),
    expressionReplacements,
  }
}

function analyzeExpressions(
  expressions: SimpleExpressionNode[],
): ExpressionAnalysis {
  const seenVariable: Record<string, number> = Object.create(null)
  const variableToExpMap = new Map<string, Set<SimpleExpressionNode>>()
  const expressionRecords = new Map<SimpleExpressionNode, ExpressionRecord>()
  const seenIdentifier = new Set<string>()
  const updatedVariable = new Set<string>()

  const getRecord = (exp: SimpleExpressionNode): ExpressionRecord => {
    let record = expressionRecords.get(exp)
    if (!record) {
      expressionRecords.set(exp, (record = { variables: [] }))
    }
    return record
  }

  const registerVariable = (
    name: string,
    exp: SimpleExpressionNode,
    isIdentifier: boolean,
    loc?: SourceRange,
    parentStack: Node[] = [],
  ) => {
    if (isIdentifier) seenIdentifier.add(name)
    seenVariable[name] = (seenVariable[name] || 0) + 1
    variableToExpMap.set(
      name,
      (variableToExpMap.get(name) || new Set()).add(exp),
    )

    getRecord(exp).variables.push({ name, loc })

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

    const seenParents = new Set<Node>()
    walkIdentifiers(exp.ast, (currentNode, parent, parentStack) => {
      if (parent && isMemberExpression(parent) && !seenParents.has(parent)) {
        seenParents.add(parent)
        let hasGlobalIdentifier = false
        const memberExp = extractMemberExpression(parent, id => {
          registerVariable(id.name, exp, true, {
            start: id.start!,
            end: id.end!,
          })
          if (isGloballyAllowed(id.name)) hasGlobalIdentifier = true
        })

        const parentOfMemberExp = parentStack[parentStack.length - 2]
        if (parentOfMemberExp && isCallExpression(parentOfMemberExp)) {
          return
        }

        // skip member expressions containing globally allowed identifiers
        // e.g. obj[Math.random()] - the call may have side effects
        if (hasGlobalIdentifier) return

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
    expressionRecords,
    updatedVariable,
  }
}

function getProcessedExpression(
  exp: SimpleExpressionNode,
  expressionReplacements: Map<SimpleExpressionNode, SimpleExpressionNode>,
): SimpleExpressionNode {
  return expressionReplacements.get(exp) || exp
}

function setExpressionReplacement(
  expressionReplacements: Map<SimpleExpressionNode, SimpleExpressionNode>,
  exp: SimpleExpressionNode,
  content: string,
  ast: Node | null,
): void {
  expressionReplacements.set(
    exp,
    extend(
      { ast },
      createSimpleExpression(content, exp.isStatic, exp.loc, exp.constType),
    ),
  )
}

function processRepeatedVariables(
  context: CodegenContext,
  seenVariable: Record<string, number>,
  variableToExpMap: Map<string, Set<SimpleExpressionNode>>,
  expressionRecords: Map<SimpleExpressionNode, ExpressionRecord>,
  seenIdentifier: Set<string>,
  updatedVariable: Set<string>,
  reservedNames: Set<string>,
  expressionReplacements: Map<SimpleExpressionNode, SimpleExpressionNode>,
): DeclarationValue[] {
  const declarations: DeclarationValue[] = []
  const declaredNames = new Set<string>()
  const replacementPlan: ReplacementPlan = new Map()

  for (const [name, exps] of variableToExpMap) {
    if (updatedVariable.has(name)) continue
    // skip globally allowed identifiers - they are not reactive and
    // their method calls (e.g. Math.random()) may have side effects
    if (isGloballyAllowed(name)) continue
    if (seenVariable[name] > 1 && exps.size > 0) {
      const isIdentifier = seenIdentifier.has(name)
      const varName = isIdentifier
        ? name
        : getUniqueDeclarationName(genVarName(name), reservedNames)

      // replaces all non-identifiers with the new name. if node content
      // includes only one member expression, it will become an identifier,
      // e.g., foo[baz] -> foo_baz.
      // for identifiers, we don't need to replace the content - they will be
      // replaced during context.withId(..., ids)
      exps.forEach(node => {
        if (node.ast && varName !== name) {
          for (const variable of getExpressionVariables(
            expressionRecords,
            node,
          )) {
            if (variable.name === name && variable.loc) {
              queueContentReplacement(replacementPlan, node, {
                start: variable.loc.start - 1,
                end: variable.loc.end - 1,
                content: varName,
              })
            }
          }
        }
      })

      if (
        !declaredNames.has(varName) &&
        (!isIdentifier || shouldDeclareVariable(name, expressionRecords, exps))
      ) {
        declaredNames.add(varName)
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

  applyReplacementPlan(context, expressionReplacements, replacementPlan)

  return declarations
}

function shouldDeclareVariable(
  name: string,
  expressionRecords: Map<SimpleExpressionNode, ExpressionRecord>,
  exps: Set<SimpleExpressionNode>,
): boolean {
  const variableUsages: VariableUse[][] = []
  let allSingleVariable = true
  let hasRepeatedName = false
  let hasDifferentLength = false

  outer: for (const exp of exps) {
    const variables = getExpressionVariables(expressionRecords, exp)

    if (allSingleVariable && variables.length !== 1) {
      allSingleVariable = false
    }

    if (
      !hasDifferentLength &&
      variableUsages.length > 0 &&
      variables.length !== variableUsages[0].length
    ) {
      hasDifferentLength = true
    }

    let nameCount = 0
    for (const variable of variables) {
      if (variable.name === name && ++nameCount > 1) {
        hasRepeatedName = true
        break outer
      }
    }

    variableUsages.push(variables)
  }

  // assume name equals to `foo`
  // if each expression only references `foo`, declaration is needed
  // to avoid reactivity tracking
  // e.g., [[foo],[foo]]
  if (allSingleVariable) {
    return true
  }

  // if `foo` appears multiple times in one array, declaration is needed
  // e.g., [[foo,foo]]
  if (hasRepeatedName) {
    return true
  }

  const first = variableUsages[0]
  // if arrays have different lengths, declaration is needed
  // e.g., [[foo],[foo,bar]]
  if (hasDifferentLength) {
    // special case, no declaration needed if one array is a subset of the other
    // because they will be treated as repeated expressions
    // e.g., [[foo,bar],[foo,foo,bar]] -> const foo_bar = _ctx.foo + _ctx.bar
    for (const variables of variableUsages) {
      if (variables.length === first.length) {
        continue
      }

      const longer = variables.length > first.length ? variables : first
      const shorter = variables.length > first.length ? first : variables
      const shorterNames = new Set<string>()
      for (const variable of shorter) {
        shorterNames.add(variable.name)
      }

      let isSubset = true
      for (const variable of longer) {
        if (!shorterNames.has(variable.name)) {
          isSubset = false
          break
        }
      }
      if (isSubset) {
        return false
      }
    }
    return true
  }
  // if arrays are identical, no declaration needed
  // because they will be treated as repeated expressions
  // e.g., [[foo,bar],[foo,bar]] -> const foo_bar = _ctx.foo + _ctx.bar
  for (const variables of variableUsages) {
    for (let i = 0; i < variables.length; i++) {
      if (variables[i].name !== first[i].name) {
        return true
      }
    }
  }

  return false
}

function processRepeatedExpressions(
  context: CodegenContext,
  expressions: SimpleExpressionNode[],
  varDeclarations: DeclarationValue[],
  updatedVariable: Set<string>,
  expressionRecords: Map<SimpleExpressionNode, ExpressionRecord>,
  reservedNames: Set<string>,
  expressionReplacements: Map<SimpleExpressionNode, SimpleExpressionNode>,
): DeclarationValue[] {
  const declarations: DeclarationValue[] = []
  const seenExp = new Map<string, SeenExpression>()

  for (const exp of expressions) {
    const vars = expressionRecords.get(exp)?.variables
    if (!vars) continue

    const processed = getProcessedExpression(exp, expressionReplacements)
    if (canCacheExpression(processed, vars, updatedVariable)) {
      const seen = seenExp.get(processed.content)
      if (seen) {
        seen.count++
      } else {
        seenExp.set(processed.content, { count: 1, first: exp })
      }
    }
  }

  const repeatedExpressions = [...seenExp].sort(
    ([contentA], [contentB]) => contentB.length - contentA.length,
  )
  for (const [content, { count, first }] of repeatedExpressions) {
    if (count > 1) {
      // foo + baz -> foo_baz
      // if foo and baz have no other references, we don't need to declare separate variables
      // instead of:
      // const foo = _ctx.foo
      // const baz = _ctx.baz
      // const foo_baz = foo + baz
      // we can generate:
      // const foo_baz = _ctx.foo + _ctx.baz
      const removedDeclarations: Array<{ name: string; rawName: string }> = []
      for (let i = varDeclarations.length - 1; i >= 0; i--) {
        const item = varDeclarations[i]
        if (!item.exps || !item.seenCount) continue

        const shouldRemove = [...item.exps].every(
          node =>
            getProcessedExpression(node, expressionReplacements).content ===
              content && item.seenCount === count,
        )
        if (shouldRemove) {
          removedDeclarations.push({
            name: item.name,
            rawName: item.rawName!,
          })
          reservedNames.delete(item.name)
          varDeclarations.splice(i, 1)
        }
      }
      const value = extend(
        {},
        getProcessedExpression(first, expressionReplacements),
      )
      const restorePlan: ContentReplacement[] = []
      for (const { name, rawName } of removedDeclarations) {
        restorePlan.push(...findIdentifierReplacements(value, name, rawName))
      }
      if (restorePlan.length) {
        value.content = applyContentReplacements(value.content, restorePlan)
        if (value.ast) value.ast = parseExp(context, value.content)
      }
      const varName = getUniqueDeclarationName(
        genVarName(content),
        reservedNames,
      )
      declarations.push({
        name: varName,
        value,
      })

      // assume content equals to `foo + baz`
      for (const exp of expressions) {
        const processed = getProcessedExpression(exp, expressionReplacements)
        // foo + baz -> foo_baz
        if (processed.content === content) {
          setExpressionReplacement(expressionReplacements, exp, varName, null)
        }
        // foo + foo + baz -> foo + foo_baz
        else if (processed.content.includes(content)) {
          const replacements = findContentReplacements(
            processed,
            content,
            varName,
          )
          if (replacements.length) {
            const replacedContent = applyContentReplacements(
              processed.content,
              replacements,
            )
            setExpressionReplacement(
              expressionReplacements,
              exp,
              replacedContent,
              parseExp(context, replacedContent),
            )
          }
        }
      }
    }
  }

  return declarations
}

function canCacheExpression(
  processed: SimpleExpressionNode,
  vars: VariableUse[],
  updatedVariable: Set<string>,
): boolean {
  if (!processed.ast || processed.ast.type === 'Identifier') {
    return false
  }

  for (const { name } of vars) {
    if (updatedVariable.has(name) || isGloballyAllowed(name)) {
      return false
    }
  }

  return true
}

function getExpressionVariables(
  expressionRecords: Map<SimpleExpressionNode, ExpressionRecord>,
  exp: SimpleExpressionNode,
): VariableUse[] {
  return expressionRecords.get(exp)?.variables || []
}

function queueContentReplacement(
  replacementPlan: ReplacementPlan,
  exp: SimpleExpressionNode,
  replacement: ContentReplacement,
): void {
  const replacements = replacementPlan.get(exp)
  if (replacements) {
    replacements.push(replacement)
  } else {
    replacementPlan.set(exp, [replacement])
  }
}

function applyReplacementPlan(
  context: CodegenContext,
  expressionReplacements: Map<SimpleExpressionNode, SimpleExpressionNode>,
  replacementPlan: ReplacementPlan,
): void {
  for (const [exp, replacements] of replacementPlan) {
    if (!replacements.length) continue

    const content = applyContentReplacements(
      getProcessedExpression(exp, expressionReplacements).content,
      replacements,
    )
    setExpressionReplacement(
      expressionReplacements,
      exp,
      content,
      parseExp(context, content),
    )
  }
}

function findContentReplacements(
  exp: SimpleExpressionNode,
  content: string,
  replacement: string,
): ContentReplacement[] {
  const identifiers = getIdentifierRanges(exp)
  if (!identifiers.length) return []

  const replacements: ContentReplacement[] = []
  let searchStart = 0
  let start = exp.content.indexOf(content, searchStart)
  while (start !== -1) {
    const end = start + content.length
    let canReplace = false
    for (const identifier of identifiers) {
      if (start >= identifier.end || end <= identifier.start) {
        continue
      }
      if (start > identifier.start || end < identifier.end) {
        canReplace = false
        break
      }
      canReplace = true
    }
    if (canReplace) {
      replacements.push({ start, end, content: replacement })
      searchStart = end
    } else {
      searchStart = start + 1
    }
    start = exp.content.indexOf(content, searchStart)
  }

  return replacements
}

function findIdentifierReplacements(
  exp: SimpleExpressionNode,
  name: string,
  replacement: string,
): ContentReplacement[] {
  const replacements: ContentReplacement[] = []
  for (const { start, end } of getIdentifierRanges(exp)) {
    if (exp.content.slice(start, end) === name) {
      replacements.push({ start, end, content: replacement })
    }
  }
  return replacements
}

function getIdentifierRanges(exp: SimpleExpressionNode): SourceRange[] {
  if (!exp.ast || typeof exp.ast !== 'object') return []

  const identifiers: SourceRange[] = []
  walkIdentifiers(
    exp.ast,
    id => {
      identifiers.push({ start: id.start! - 1, end: id.end! - 1 })
    },
    false,
  )
  return identifiers
}

function applyContentReplacements(
  content: string,
  replacements: ContentReplacement[],
): string {
  replacements
    .sort((a, b) => b.start - a.start)
    .forEach(({ start, end, content: replacement }) => {
      content = content.slice(0, start) + replacement + content.slice(end)
    })
  return content
}

function genDeclarations(
  declarations: DeclarationValue[],
  context: CodegenContext,
  shouldDeclare: boolean,
) {
  const [frag, push] = buildCodeFragment()
  const ids: Record<string, string> = Object.create(null)
  const varNames = new Set<string>()

  // process identifiers first as expressions may rely on them
  declarations.forEach(({ name, isIdentifier, value }) => {
    if (isIdentifier) {
      const varName = (ids[name] = context.getUniqueLocalName(
        `_${name}`,
        varNames,
      ))
      if (shouldDeclare) {
        push(`const `)
      }
      push(`${varName} = `, ...genExpression(value, context), NEWLINE)
    }
  })

  // process expressions
  declarations.forEach(({ name, isIdentifier, value }) => {
    if (!isIdentifier) {
      const varName = context.getUniqueLocalName(`_${name}`, varNames)
      if (shouldDeclare) {
        push(`const `)
      }
      push(
        `${varName} = `,
        ...context.withId(() => genExpression(value, context), ids),
        NEWLINE,
      )
      ids[name] = varName
    }
  })

  return { ids, frag, varNames: [...varNames] }
}

function parseExp(context: CodegenContext, content: string): Node {
  return parseExpression(
    `(${content})`,
    getParserOptions(context.options.expressionPlugins),
  )
}

export function genVarName(exp: string): string {
  return `${exp
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/_+$/, '')}`
}

function getUniqueDeclarationName(
  baseName: string,
  reservedNames: Set<string>,
): string {
  const normalizedBase = baseName || 'exp'
  let name = normalizedBase
  let i = 1
  while (reservedNames.has(name)) {
    name = `${normalizedBase}_${i++}`
  }
  reservedNames.add(name)
  return name
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
    case 'OptionalCallExpression': // foo[bar?.(baz)]
      return `${extractMemberExpression(exp.callee, onIdentifier)}?.(${exp.arguments.map(arg => extractMemberExpression(arg, onIdentifier)).join(', ')})`
    case 'MemberExpression': // foo[bar.baz]
    case 'OptionalMemberExpression': // foo?.bar
      const object = extractMemberExpression(exp.object, onIdentifier)
      const prop = exp.computed
        ? `[${extractMemberExpression(exp.property, onIdentifier)}]`
        : `.${extractMemberExpression(exp.property, NOOP)}`
      return `${object}${prop}`
    case 'TSNonNullExpression': // foo!.bar
      return `${extractMemberExpression(exp.expression, onIdentifier)}`
    default:
      return ''
  }
}

const isCallExpression = (node: Node) => {
  return (
    node.type === 'CallExpression' || node.type === 'OptionalCallExpression'
  )
}

const isMemberExpression = (node: Node) => {
  return (
    node.type === 'MemberExpression' ||
    node.type === 'OptionalMemberExpression' ||
    node.type === 'TSNonNullExpression'
  )
}
