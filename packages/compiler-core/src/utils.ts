import {
  type BlockCodegenNode,
  type CacheExpression,
  type CallExpression,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type ExpressionNode,
  type IfBranchNode,
  type InterpolationNode,
  type JSChildNode,
  type MemoExpression,
  NodeTypes,
  type ObjectExpression,
  type Position,
  type Property,
  type RenderSlotCall,
  type RootNode,
  type SimpleExpressionNode,
  type SlotOutletNode,
  type TemplateChildNode,
  type TemplateNode,
  type TextNode,
  type VNodeCall,
  createCallExpression,
  createObjectExpression,
} from './ast'
import type { TransformContext } from './transform'
import {
  BASE_TRANSITION,
  GUARD_REACTIVE_PROPS,
  KEEP_ALIVE,
  MERGE_PROPS,
  NORMALIZE_PROPS,
  SUSPENSE,
  TELEPORT,
  TO_HANDLERS,
  WITH_MEMO,
} from './runtimeHelpers'
import { NOOP, isObject, isString } from '@vue/shared'
import type { PropsExpression } from './transforms/transformElement'
import { parseExpression } from '@babel/parser'
import type { Expression, Node } from '@babel/types'
import { unwrapTSNode } from './babelUtils'

export const isStaticExp = (p: JSChildNode): p is SimpleExpressionNode =>
  p.type === NodeTypes.SIMPLE_EXPRESSION && p.isStatic

export function isCoreComponent(tag: string): symbol | void {
  switch (tag) {
    case 'Teleport':
    case 'teleport':
      return TELEPORT
    case 'Suspense':
    case 'suspense':
      return SUSPENSE
    case 'KeepAlive':
    case 'keep-alive':
      return KEEP_ALIVE
    case 'BaseTransition':
    case 'base-transition':
      return BASE_TRANSITION
  }
}

const nonIdentifierRE = /^\d|[^\$\w\xA0-\uFFFF]/
export const isSimpleIdentifier = (name: string): boolean =>
  !nonIdentifierRE.test(name)

enum MemberExpLexState {
  inMemberExp,
  inBrackets,
  inParens,
  inString,
}

const validFirstIdentCharRE = /[A-Za-z_$\xA0-\uFFFF]/
const validIdentCharRE = /[\.\?\w$\xA0-\uFFFF]/
const whitespaceRE = /\s+[.[]\s*|\s*[.[]\s+/g

const getExpSource = (exp: ExpressionNode): string =>
  exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : exp.loc.source

/**
 * Simple lexer to check if an expression is a member expression. This is
 * lax and only checks validity at the root level (i.e. does not validate exps
 * inside square brackets), but it's ok since these are only used on template
 * expressions and false positives are invalid expressions in the first place.
 */
export const isMemberExpressionBrowser = (exp: ExpressionNode): boolean => {
  // remove whitespaces around . or [ first
  const path = getExpSource(exp)
    .trim()
    .replace(whitespaceRE, s => s.trim())

  let state = MemberExpLexState.inMemberExp
  let stateStack: MemberExpLexState[] = []
  let currentOpenBracketCount = 0
  let currentOpenParensCount = 0
  let currentStringType: "'" | '"' | '`' | null = null

  for (let i = 0; i < path.length; i++) {
    const char = path.charAt(i)
    switch (state) {
      case MemberExpLexState.inMemberExp:
        if (char === '[') {
          stateStack.push(state)
          state = MemberExpLexState.inBrackets
          currentOpenBracketCount++
        } else if (char === '(') {
          stateStack.push(state)
          state = MemberExpLexState.inParens
          currentOpenParensCount++
        } else if (
          !(i === 0 ? validFirstIdentCharRE : validIdentCharRE).test(char)
        ) {
          return false
        }
        break
      case MemberExpLexState.inBrackets:
        if (char === `'` || char === `"` || char === '`') {
          stateStack.push(state)
          state = MemberExpLexState.inString
          currentStringType = char
        } else if (char === `[`) {
          currentOpenBracketCount++
        } else if (char === `]`) {
          if (!--currentOpenBracketCount) {
            state = stateStack.pop()!
          }
        }
        break
      case MemberExpLexState.inParens:
        if (char === `'` || char === `"` || char === '`') {
          stateStack.push(state)
          state = MemberExpLexState.inString
          currentStringType = char
        } else if (char === `(`) {
          currentOpenParensCount++
        } else if (char === `)`) {
          // if the exp ends as a call then it should not be considered valid
          if (i === path.length - 1) {
            return false
          }
          if (!--currentOpenParensCount) {
            state = stateStack.pop()!
          }
        }
        break
      case MemberExpLexState.inString:
        if (char === currentStringType) {
          state = stateStack.pop()!
          currentStringType = null
        }
        break
    }
  }
  return !currentOpenBracketCount && !currentOpenParensCount
}

export const isMemberExpressionNode: (
  exp: ExpressionNode,
  context: TransformContext,
) => boolean = __BROWSER__
  ? (NOOP as any)
  : (exp, context) => {
      try {
        let ret: Node =
          exp.ast ||
          parseExpression(getExpSource(exp), {
            plugins: context.expressionPlugins
              ? [...context.expressionPlugins, 'typescript']
              : ['typescript'],
          })
        ret = unwrapTSNode(ret) as Expression
        return (
          ret.type === 'MemberExpression' ||
          ret.type === 'OptionalMemberExpression' ||
          (ret.type === 'Identifier' && ret.name !== 'undefined')
        )
      } catch (e) {
        return false
      }
    }

export const isMemberExpression: (
  exp: ExpressionNode,
  context: TransformContext,
) => boolean = __BROWSER__ ? isMemberExpressionBrowser : isMemberExpressionNode

const fnExpRE =
  /^\s*(async\s*)?(\([^)]*?\)|[\w$_]+)\s*(:[^=]+)?=>|^\s*(async\s+)?function(?:\s+[\w$]+)?\s*\(/

export const isFnExpressionBrowser: (exp: ExpressionNode) => boolean = exp =>
  fnExpRE.test(getExpSource(exp))

export const isFnExpressionNode: (
  exp: ExpressionNode,
  context: TransformContext,
) => boolean = __BROWSER__
  ? (NOOP as any)
  : (exp, context) => {
      try {
        let ret: Node =
          exp.ast ||
          parseExpression(getExpSource(exp), {
            plugins: context.expressionPlugins
              ? [...context.expressionPlugins, 'typescript']
              : ['typescript'],
          })
        // parser may parse the exp as statements when it contains semicolons
        if (ret.type === 'Program') {
          ret = ret.body[0]
          if (ret.type === 'ExpressionStatement') {
            ret = ret.expression
          }
        }
        ret = unwrapTSNode(ret) as Expression
        return (
          ret.type === 'FunctionExpression' ||
          ret.type === 'ArrowFunctionExpression'
        )
      } catch (e) {
        return false
      }
    }

export const isFnExpression: (
  exp: ExpressionNode,
  context: TransformContext,
) => boolean = __BROWSER__ ? isFnExpressionBrowser : isFnExpressionNode

export function advancePositionWithClone(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length,
): Position {
  return advancePositionWithMutation(
    {
      offset: pos.offset,
      line: pos.line,
      column: pos.column,
    },
    source,
    numberOfCharacters,
  )
}

// advance by mutation without cloning (for performance reasons), since this
// gets called a lot in the parser
export function advancePositionWithMutation(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length,
): Position {
  let linesCount = 0
  let lastNewLinePos = -1
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10 /* newline char code */) {
      linesCount++
      lastNewLinePos = i
    }
  }

  pos.offset += numberOfCharacters
  pos.line += linesCount
  pos.column =
    lastNewLinePos === -1
      ? pos.column + numberOfCharacters
      : numberOfCharacters - lastNewLinePos

  return pos
}

export function assert(condition: boolean, msg?: string): void {
  /* v8 ignore next 3 */
  if (!condition) {
    throw new Error(msg || `unexpected compiler condition`)
  }
}

export function findDir(
  node: ElementNode,
  name: string | RegExp,
  allowEmpty: boolean = false,
): DirectiveNode | undefined {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (
      p.type === NodeTypes.DIRECTIVE &&
      (allowEmpty || p.exp) &&
      (isString(name) ? p.name === name : name.test(p.name))
    ) {
      return p
    }
  }
}

export function findProp(
  node: ElementNode,
  name: string,
  dynamicOnly: boolean = false,
  allowEmpty: boolean = false,
): ElementNode['props'][0] | undefined {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      if (dynamicOnly) continue
      if (p.name === name && (p.value || allowEmpty)) {
        return p
      }
    } else if (
      p.name === 'bind' &&
      (p.exp || allowEmpty) &&
      isStaticArgOf(p.arg, name)
    ) {
      return p
    }
  }
}

export function isStaticArgOf(
  arg: DirectiveNode['arg'],
  name: string,
): boolean {
  return !!(arg && isStaticExp(arg) && arg.content === name)
}

export function hasDynamicKeyVBind(node: ElementNode): boolean {
  return node.props.some(
    p =>
      p.type === NodeTypes.DIRECTIVE &&
      p.name === 'bind' &&
      (!p.arg || // v-bind="obj"
        p.arg.type !== NodeTypes.SIMPLE_EXPRESSION || // v-bind:[_ctx.foo]
        !p.arg.isStatic), // v-bind:[foo]
  )
}

export function isText(
  node: TemplateChildNode,
): node is TextNode | InterpolationNode {
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT
}

export function isVSlot(p: ElementNode['props'][0]): p is DirectiveNode {
  return p.type === NodeTypes.DIRECTIVE && p.name === 'slot'
}

export function isTemplateNode(
  node: RootNode | TemplateChildNode,
): node is TemplateNode {
  return (
    node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.TEMPLATE
  )
}

export function isSlotOutlet(
  node: RootNode | TemplateChildNode,
): node is SlotOutletNode {
  return node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.SLOT
}

const propsHelperSet = new Set([NORMALIZE_PROPS, GUARD_REACTIVE_PROPS])

function getUnnormalizedProps(
  props: PropsExpression | '{}',
  callPath: CallExpression[] = [],
): [PropsExpression | '{}', CallExpression[]] {
  if (
    props &&
    !isString(props) &&
    props.type === NodeTypes.JS_CALL_EXPRESSION
  ) {
    const callee = props.callee
    if (!isString(callee) && propsHelperSet.has(callee)) {
      return getUnnormalizedProps(
        props.arguments[0] as PropsExpression,
        callPath.concat(props),
      )
    }
  }
  return [props, callPath]
}
export function injectProp(
  node: VNodeCall | RenderSlotCall,
  prop: Property,
  context: TransformContext,
): void {
  let propsWithInjection: ObjectExpression | CallExpression | undefined
  /**
   * 1. mergeProps(...)
   * 2. toHandlers(...)
   * 3. normalizeProps(...)
   * 4. normalizeProps(guardReactiveProps(...))
   *
   * we need to get the real props before normalization
   */
  let props =
    node.type === NodeTypes.VNODE_CALL ? node.props : node.arguments[2]
  let callPath: CallExpression[] = []
  let parentCall: CallExpression | undefined
  if (
    props &&
    !isString(props) &&
    props.type === NodeTypes.JS_CALL_EXPRESSION
  ) {
    const ret = getUnnormalizedProps(props)
    props = ret[0]
    callPath = ret[1]
    parentCall = callPath[callPath.length - 1]
  }

  if (props == null || isString(props)) {
    propsWithInjection = createObjectExpression([prop])
  } else if (props.type === NodeTypes.JS_CALL_EXPRESSION) {
    // merged props... add ours
    // only inject key to object literal if it's the first argument so that
    // if doesn't override user provided keys
    const first = props.arguments[0] as string | JSChildNode
    if (!isString(first) && first.type === NodeTypes.JS_OBJECT_EXPRESSION) {
      // #6631
      if (!hasProp(prop, first)) {
        first.properties.unshift(prop)
      }
    } else {
      if (props.callee === TO_HANDLERS) {
        // #2366
        propsWithInjection = createCallExpression(context.helper(MERGE_PROPS), [
          createObjectExpression([prop]),
          props,
        ])
      } else {
        props.arguments.unshift(createObjectExpression([prop]))
      }
    }
    !propsWithInjection && (propsWithInjection = props)
  } else if (props.type === NodeTypes.JS_OBJECT_EXPRESSION) {
    if (!hasProp(prop, props)) {
      props.properties.unshift(prop)
    }
    propsWithInjection = props
  } else {
    // single v-bind with expression, return a merged replacement
    propsWithInjection = createCallExpression(context.helper(MERGE_PROPS), [
      createObjectExpression([prop]),
      props,
    ])
    // in the case of nested helper call, e.g. `normalizeProps(guardReactiveProps(props))`,
    // it will be rewritten as `normalizeProps(mergeProps({ key: 0 }, props))`,
    // the `guardReactiveProps` will no longer be needed
    if (parentCall && parentCall.callee === GUARD_REACTIVE_PROPS) {
      parentCall = callPath[callPath.length - 2]
    }
  }
  if (node.type === NodeTypes.VNODE_CALL) {
    if (parentCall) {
      parentCall.arguments[0] = propsWithInjection
    } else {
      node.props = propsWithInjection
    }
  } else {
    if (parentCall) {
      parentCall.arguments[0] = propsWithInjection
    } else {
      node.arguments[2] = propsWithInjection
    }
  }
}

// check existing key to avoid overriding user provided keys
function hasProp(prop: Property, props: ObjectExpression) {
  let result = false
  if (prop.key.type === NodeTypes.SIMPLE_EXPRESSION) {
    const propKeyName = prop.key.content
    result = props.properties.some(
      p =>
        p.key.type === NodeTypes.SIMPLE_EXPRESSION &&
        p.key.content === propKeyName,
    )
  }
  return result
}

export function toValidAssetId(
  name: string,
  type: 'component' | 'directive' | 'filter',
): string {
  // see issue#4422, we need adding identifier on validAssetId if variable `name` has specific character
  return `_${type}_${name.replace(/[^\w]/g, (searchValue, replaceValue) => {
    return searchValue === '-' ? '_' : name.charCodeAt(replaceValue).toString()
  })}`
}

// Check if a node contains expressions that reference current context scope ids
export function hasScopeRef(
  node:
    | TemplateChildNode
    | IfBranchNode
    | ExpressionNode
    | CacheExpression
    | undefined,
  ids: TransformContext['identifiers'],
): boolean {
  if (!node || Object.keys(ids).length === 0) {
    return false
  }
  switch (node.type) {
    case NodeTypes.ELEMENT:
      for (let i = 0; i < node.props.length; i++) {
        const p = node.props[i]
        if (
          p.type === NodeTypes.DIRECTIVE &&
          (hasScopeRef(p.arg, ids) || hasScopeRef(p.exp, ids))
        ) {
          return true
        }
      }
      return node.children.some(c => hasScopeRef(c, ids))
    case NodeTypes.FOR:
      if (hasScopeRef(node.source, ids)) {
        return true
      }
      return node.children.some(c => hasScopeRef(c, ids))
    case NodeTypes.IF:
      return node.branches.some(b => hasScopeRef(b, ids))
    case NodeTypes.IF_BRANCH:
      if (hasScopeRef(node.condition, ids)) {
        return true
      }
      return node.children.some(c => hasScopeRef(c, ids))
    case NodeTypes.SIMPLE_EXPRESSION:
      return (
        !node.isStatic &&
        isSimpleIdentifier(node.content) &&
        !!ids[node.content]
      )
    case NodeTypes.COMPOUND_EXPRESSION:
      return node.children.some(c => isObject(c) && hasScopeRef(c, ids))
    case NodeTypes.INTERPOLATION:
    case NodeTypes.TEXT_CALL:
      return hasScopeRef(node.content, ids)
    case NodeTypes.TEXT:
    case NodeTypes.COMMENT:
    case NodeTypes.JS_CACHE_EXPRESSION:
      return false
    default:
      if (__DEV__) {
        const exhaustiveCheck: never = node
        exhaustiveCheck
      }
      return false
  }
}

export function getMemoedVNodeCall(
  node: BlockCodegenNode | MemoExpression,
): VNodeCall | RenderSlotCall {
  if (node.type === NodeTypes.JS_CALL_EXPRESSION && node.callee === WITH_MEMO) {
    return node.arguments[1].returns as VNodeCall
  } else {
    return node
  }
}

export const forAliasRE: RegExp = /([\s\S]*?)\s+(?:in|of)\s+(\S[\s\S]*)/
