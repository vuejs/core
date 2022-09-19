import {
  SourceLocation,
  Position,
  ElementNode,
  NodeTypes,
  CallExpression,
  createCallExpression,
  DirectiveNode,
  ElementTypes,
  TemplateChildNode,
  RootNode,
  ObjectExpression,
  Property,
  JSChildNode,
  createObjectExpression,
  SlotOutletNode,
  TemplateNode,
  RenderSlotCall,
  ExpressionNode,
  IfBranchNode,
  TextNode,
  InterpolationNode,
  VNodeCall,
  SimpleExpressionNode,
  BlockCodegenNode,
  MemoExpression,
  createVNodeCall
} from './ast'
import { TransformContext } from './transform'
import {
  MERGE_PROPS,
  TELEPORT,
  SUSPENSE,
  KEEP_ALIVE,
  BASE_TRANSITION,
  TO_HANDLERS,
  NORMALIZE_PROPS,
  GUARD_REACTIVE_PROPS,
  CREATE_BLOCK,
  CREATE_ELEMENT_BLOCK,
  CREATE_VNODE,
  CREATE_ELEMENT_VNODE,
  WITH_MEMO,
  OPEN_BLOCK,
  FRAGMENT
} from './runtimeHelpers'
import { isString, isObject, hyphenate, extend, NOOP, PatchFlags, PatchFlagNames } from '@vue/shared'
import { PropsExpression } from './transforms/transformElement'
import { parseExpression } from '@babel/parser'
import { Expression } from '@babel/types'

export const isStaticExp = (p: JSChildNode): p is SimpleExpressionNode =>
  p.type === NodeTypes.SIMPLE_EXPRESSION && p.isStatic

export const isBuiltInType = (tag: string, expected: string): boolean =>
  tag === expected || tag === hyphenate(expected)

export function isCoreComponent(tag: string): symbol | void {
  if (isBuiltInType(tag, 'Teleport')) {
    return TELEPORT
  } else if (isBuiltInType(tag, 'Suspense')) {
    return SUSPENSE
  } else if (isBuiltInType(tag, 'KeepAlive')) {
    return KEEP_ALIVE
  } else if (isBuiltInType(tag, 'BaseTransition')) {
    return BASE_TRANSITION
  }
}

const nonIdentifierRE = /^\d|[^\$\w]/
export const isSimpleIdentifier = (name: string): boolean =>
  !nonIdentifierRE.test(name)

const enum MemberExpLexState {
  inMemberExp,
  inBrackets,
  inParens,
  inString
}

const validFirstIdentCharRE = /[A-Za-z_$\xA0-\uFFFF]/
const validIdentCharRE = /[\.\?\w$\xA0-\uFFFF]/
const whitespaceRE = /\s+[.[]\s*|\s*[.[]\s+/g

/**
 * Simple lexer to check if an expression is a member expression. This is
 * lax and only checks validity at the root level (i.e. does not validate exps
 * inside square brackets), but it's ok since these are only used on template
 * expressions and false positives are invalid expressions in the first place.
 */
export const isMemberExpressionBrowser = (path: string): boolean => {
  // remove whitespaces around . or [ first
  path = path.trim().replace(whitespaceRE, s => s.trim())

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

export const isMemberExpressionNode = __BROWSER__
  ? (NOOP as any as (path: string, context: TransformContext) => boolean)
  : (path: string, context: TransformContext): boolean => {
      try {
        let ret: Expression = parseExpression(path, {
          plugins: context.expressionPlugins
        })
        if (ret.type === 'TSAsExpression' || ret.type === 'TSTypeAssertion') {
          ret = ret.expression
        }
        return (
          ret.type === 'MemberExpression' ||
          ret.type === 'OptionalMemberExpression' ||
          ret.type === 'Identifier'
        )
      } catch (e) {
        return false
      }
    }

export const isMemberExpression = __BROWSER__
  ? isMemberExpressionBrowser
  : isMemberExpressionNode

export function getInnerRange(
  loc: SourceLocation,
  offset: number,
  length: number
): SourceLocation {
  __TEST__ && assert(offset <= loc.source.length)
  const source = loc.source.slice(offset, offset + length)
  const newLoc: SourceLocation = {
    source,
    start: advancePositionWithClone(loc.start, loc.source, offset),
    end: loc.end
  }

  if (length != null) {
    __TEST__ && assert(offset + length <= loc.source.length)
    newLoc.end = advancePositionWithClone(
      loc.start,
      loc.source,
      offset + length
    )
  }

  return newLoc
}

export function advancePositionWithClone(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length
): Position {
  return advancePositionWithMutation(
    extend({}, pos),
    source,
    numberOfCharacters
  )
}

// advance by mutation without cloning (for performance reasons), since this
// gets called a lot in the parser
export function advancePositionWithMutation(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length
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

export function assert(condition: boolean, msg?: string) {
  /* istanbul ignore if */
  if (!condition) {
    throw new Error(msg || `unexpected compiler condition`)
  }
}

export function findDir(
  node: ElementNode,
  name: string | RegExp,
  allowEmpty: boolean = false
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
  allowEmpty: boolean = false
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
  name: string
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
        !p.arg.isStatic) // v-bind:[foo]
  )
}

export function isText(
  node: TemplateChildNode
): node is TextNode | InterpolationNode {
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT
}

export function isVSlot(p: ElementNode['props'][0]): p is DirectiveNode {
  return p.type === NodeTypes.DIRECTIVE && p.name === 'slot'
}

export function isTemplateNode(
  node: RootNode | TemplateChildNode
): node is TemplateNode {
  return (
    node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.TEMPLATE
  )
}

export function isSlotOutlet(
  node: RootNode | TemplateChildNode
): node is SlotOutletNode {
  return node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.SLOT
}

export function getVNodeHelper(ssr: boolean, isComponent: boolean) {
  return ssr || isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE
}

export function getVNodeBlockHelper(ssr: boolean, isComponent: boolean) {
  return ssr || isComponent ? CREATE_BLOCK : CREATE_ELEMENT_BLOCK
}

const propsHelperSet = new Set([NORMALIZE_PROPS, GUARD_REACTIVE_PROPS])

function getUnnormalizedProps(
  props: PropsExpression | '{}',
  callPath: CallExpression[] = []
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
        callPath.concat(props)
      )
    }
  }
  return [props, callPath]
}
export function injectProp(
  node: VNodeCall | RenderSlotCall,
  prop: Property,
  context: TransformContext
) {
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
      first.properties.unshift(prop)
    } else {
      if (props.callee === TO_HANDLERS) {
        // #2366
        propsWithInjection = createCallExpression(context.helper(MERGE_PROPS), [
          createObjectExpression([prop]),
          props
        ])
      } else {
        props.arguments.unshift(createObjectExpression([prop]))
      }
    }
    !propsWithInjection && (propsWithInjection = props)
  } else if (props.type === NodeTypes.JS_OBJECT_EXPRESSION) {
    let alreadyExists = false
    // check existing key to avoid overriding user provided keys
    if (prop.key.type === NodeTypes.SIMPLE_EXPRESSION) {
      const propKeyName = prop.key.content
      alreadyExists = props.properties.some(
        p =>
          p.key.type === NodeTypes.SIMPLE_EXPRESSION &&
          p.key.content === propKeyName
      )
    }
    if (!alreadyExists) {
      props.properties.unshift(prop)
    }
    propsWithInjection = props
  } else {
    // single v-bind with expression, return a merged replacement
    propsWithInjection = createCallExpression(context.helper(MERGE_PROPS), [
      createObjectExpression([prop]),
      props
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

export function toValidAssetId(
  name: string,
  type: 'component' | 'directive' | 'filter'
): string {
  // see issue#4422, we need adding identifier on validAssetId if variable `name` has specific character
  return `_${type}_${name.replace(/[^\w]/g, (searchValue, replaceValue) => {
    return searchValue === '-' ? '_' : name.charCodeAt(replaceValue).toString()
  })}`
}

// Check if a node contains expressions that reference current context scope ids
export function hasScopeRef(
  node: TemplateChildNode | IfBranchNode | ExpressionNode | undefined,
  ids: TransformContext['identifiers']
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
      return false
    default:
      if (__DEV__) {
        const exhaustiveCheck: never = node
        exhaustiveCheck
      }
      return false
  }
}

export function getMemoedVNodeCall(node: BlockCodegenNode | MemoExpression) {
  if (node.type === NodeTypes.JS_CALL_EXPRESSION && node.callee === WITH_MEMO) {
    return node.arguments[1].returns as VNodeCall
  } else {
    return node
  }
}

export function makeBlock(
  node: VNodeCall,
  { helper, removeHelper, inSSR }: TransformContext
) {
  if (!node.isBlock) {
    node.isBlock = true
    removeHelper(getVNodeHelper(inSSR, node.isComponent))
    helper(OPEN_BLOCK)
    helper(getVNodeBlockHelper(inSSR, node.isComponent))
  }
}

export function makeFragmentBlock(root: RootNode, context: TransformContext) {
  const { helper } = context
  const { children } = root
  let patchFlag = PatchFlags.STABLE_FRAGMENT
  let patchFlagText = PatchFlagNames[PatchFlags.STABLE_FRAGMENT]
  // check if the fragment actually contains a single valid child with
  // the rest being comments
  if (
    __DEV__ &&
    children.filter(c => c.type !== NodeTypes.COMMENT).length === 1
  ) {
    patchFlag |= PatchFlags.DEV_ROOT_FRAGMENT
    patchFlagText += `, ${PatchFlagNames[PatchFlags.DEV_ROOT_FRAGMENT]}`
  }
  root.codegenNode = createVNodeCall(
    context,
    helper(FRAGMENT),
    undefined,
    root.children,
    patchFlag + (__DEV__ ? ` /* ${patchFlagText} */` : ``),
    undefined,
    undefined,
    true,
    undefined,
    false
  )
}
