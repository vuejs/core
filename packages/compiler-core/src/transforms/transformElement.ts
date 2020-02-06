import { NodeTransform, TransformContext } from '../transform'
import {
  NodeTypes,
  ElementTypes,
  CallExpression,
  ObjectExpression,
  ElementNode,
  DirectiveNode,
  ExpressionNode,
  ArrayExpression,
  createCallExpression,
  createArrayExpression,
  createObjectProperty,
  createSimpleExpression,
  createObjectExpression,
  Property,
  createSequenceExpression,
  ComponentNode
} from '../ast'
import { PatchFlags, PatchFlagNames, isSymbol } from '@vue/shared'
import { createCompilerError, ErrorCodes } from '../errors'
import {
  CREATE_VNODE,
  WITH_DIRECTIVES,
  RESOLVE_DIRECTIVE,
  RESOLVE_COMPONENT,
  RESOLVE_DYNAMIC_COMPONENT,
  MERGE_PROPS,
  TO_HANDLERS,
  PORTAL,
  KEEP_ALIVE,
  OPEN_BLOCK,
  CREATE_BLOCK
} from '../runtimeHelpers'
import {
  getInnerRange,
  toValidAssetId,
  findProp,
  isCoreComponent,
  isBindKey
} from '../utils'
import { buildSlots } from './vSlot'
import { isStaticNode } from './hoistStatic'

// some directive transforms (e.g. v-model) may return a symbol for runtime
// import, which should be used instead of a resolveDirective call.
const directiveImportMap = new WeakMap<DirectiveNode, symbol>()

// generate a JavaScript AST for this element's codegen
export const transformElement: NodeTransform = (node, context) => {
  if (
    !(
      node.type === NodeTypes.ELEMENT &&
      (node.tagType === ElementTypes.ELEMENT ||
        node.tagType === ElementTypes.COMPONENT)
    )
  ) {
    return
  }
  // perform the work on exit, after all child expressions have been
  // processed and merged.
  return function postTransformElement() {
    const { tag, props } = node
    const isComponent = node.tagType === ElementTypes.COMPONENT

    // <svg> and <foreignObject> must be forced into blocks so that block
    // updates inside get proper isSVG flag at runtime. (#639, #643)
    // This is technically web-specific, but splitting the logic out of core
    // leads to too much unnecessary complexity.
    const shouldUseBlock =
      !isComponent && (tag === 'svg' || tag === 'foreignObject')

    const nodeType = isComponent
      ? resolveComponentType(node as ComponentNode, context)
      : `"${tag}"`

    const args: CallExpression['arguments'] = [nodeType]

    let hasProps = props.length > 0
    let patchFlag: number = 0
    let runtimeDirectives: DirectiveNode[] | undefined
    let dynamicPropNames: string[] | undefined

    // props
    if (hasProps) {
      const propsBuildResult = buildProps(node, context)
      patchFlag = propsBuildResult.patchFlag
      dynamicPropNames = propsBuildResult.dynamicPropNames
      runtimeDirectives = propsBuildResult.directives
      if (!propsBuildResult.props) {
        hasProps = false
      } else {
        args.push(propsBuildResult.props)
      }
    }

    // children
    const hasChildren = node.children.length > 0
    if (hasChildren) {
      if (!hasProps) {
        args.push(`null`)
      }

      if (__DEV__ && nodeType === KEEP_ALIVE && node.children.length > 1) {
        context.onError(
          createCompilerError(ErrorCodes.X_KEEP_ALIVE_INVALID_CHILDREN, {
            start: node.children[0].loc.start,
            end: node.children[node.children.length - 1].loc.end,
            source: ''
          })
        )
      }

      // Portal & KeepAlive should have normal children instead of slots
      // Portal is not a real component has dedicated handling in the renderer
      // KeepAlive should not track its own deps so that it can be used inside
      // Transition
      if (isComponent && nodeType !== PORTAL && nodeType !== KEEP_ALIVE) {
        const { slots, hasDynamicSlots } = buildSlots(node, context)
        args.push(slots)
        if (hasDynamicSlots) {
          patchFlag |= PatchFlags.DYNAMIC_SLOTS
        }
      } else if (node.children.length === 1) {
        const child = node.children[0]
        const type = child.type
        // check for dynamic text children
        const hasDynamicTextChild =
          type === NodeTypes.INTERPOLATION ||
          type === NodeTypes.COMPOUND_EXPRESSION
        if (hasDynamicTextChild && !isStaticNode(child)) {
          patchFlag |= PatchFlags.TEXT
        }
        // pass directly if the only child is a text node
        // (plain / interpolation / expression)
        if (hasDynamicTextChild || type === NodeTypes.TEXT) {
          args.push(child)
        } else {
          args.push(node.children)
        }
      } else {
        args.push(node.children)
      }
    }

    // patchFlag & dynamicPropNames
    if (patchFlag !== 0) {
      if (!hasChildren) {
        if (!hasProps) {
          args.push(`null`)
        }
        args.push(`null`)
      }
      if (__DEV__) {
        const flagNames = Object.keys(PatchFlagNames)
          .map(Number)
          .filter(n => n > 0 && patchFlag & n)
          .map(n => PatchFlagNames[n])
          .join(`, `)
        args.push(patchFlag + ` /* ${flagNames} */`)
      } else {
        args.push(patchFlag + '')
      }
      if (dynamicPropNames && dynamicPropNames.length) {
        args.push(stringifyDynamicPropNames(dynamicPropNames))
      }
    }

    const { loc } = node
    const vnode = shouldUseBlock
      ? createSequenceExpression([
          createCallExpression(context.helper(OPEN_BLOCK)),
          createCallExpression(context.helper(CREATE_BLOCK), args, loc)
        ])
      : createCallExpression(context.helper(CREATE_VNODE), args, loc)
    if (runtimeDirectives && runtimeDirectives.length) {
      node.codegenNode = createCallExpression(
        context.helper(WITH_DIRECTIVES),
        [
          vnode,
          createArrayExpression(
            runtimeDirectives.map(dir => buildDirectiveArgs(dir, context)),
            loc
          )
        ],
        loc
      )
    } else {
      node.codegenNode = vnode
    }
  }
}

export function resolveComponentType(
  node: ComponentNode,
  context: TransformContext,
  ssr = false
) {
  const { tag } = node

  // 1. dynamic component
  const isProp = node.tag === 'component' && findProp(node, 'is')
  if (isProp) {
    // static <component is="foo" />
    if (isProp.type === NodeTypes.ATTRIBUTE) {
      const isType = isProp.value && isProp.value.content
      if (isType) {
        context.helper(RESOLVE_COMPONENT)
        context.components.add(isType)
        return toValidAssetId(isType, `component`)
      }
    }
    // dynamic <component :is="asdf" />
    else if (isProp.exp) {
      return createCallExpression(
        context.helper(RESOLVE_DYNAMIC_COMPONENT),
        // _ctx.$ exposes the owner instance of current render function
        [isProp.exp, context.prefixIdentifiers ? `_ctx.$` : `$`]
      )
    }
  }

  // 2. built-in components (Portal, Transition, KeepAlive, Suspense...)
  const builtIn = isCoreComponent(tag) || context.isBuiltInComponent(tag)
  if (builtIn) {
    // built-ins are simply fallthroughs / have special handling during ssr
    // no we don't need to import their runtime equivalents
    if (!ssr) context.helper(builtIn)
    return builtIn
  }

  // 3. user component (resolve)
  context.helper(RESOLVE_COMPONENT)
  context.components.add(tag)
  return toValidAssetId(tag, `component`)
}

export type PropsExpression = ObjectExpression | CallExpression | ExpressionNode

export function buildProps(
  node: ElementNode,
  context: TransformContext,
  props: ElementNode['props'] = node.props,
  ssr = false
): {
  props: PropsExpression | undefined
  directives: DirectiveNode[]
  patchFlag: number
  dynamicPropNames: string[]
} {
  const { tag, loc: elementLoc } = node
  const isComponent = node.tagType === ElementTypes.COMPONENT
  let properties: ObjectExpression['properties'] = []
  const mergeArgs: PropsExpression[] = []
  const runtimeDirectives: DirectiveNode[] = []

  // patchFlag analysis
  let patchFlag = 0
  let hasRef = false
  let hasClassBinding = false
  let hasStyleBinding = false
  let hasDynamicKeys = false
  const dynamicPropNames: string[] = []

  const analyzePatchFlag = ({ key, value }: Property) => {
    if (key.type === NodeTypes.SIMPLE_EXPRESSION && key.isStatic) {
      if (
        value.type === NodeTypes.JS_CACHE_EXPRESSION ||
        ((value.type === NodeTypes.SIMPLE_EXPRESSION ||
          value.type === NodeTypes.COMPOUND_EXPRESSION) &&
          isStaticNode(value))
      ) {
        return
      }
      const name = key.content
      if (name === 'ref') {
        hasRef = true
      } else if (name === 'class') {
        hasClassBinding = true
      } else if (name === 'style') {
        hasStyleBinding = true
      } else if (name !== 'key') {
        dynamicPropNames.push(name)
      }
    } else {
      hasDynamicKeys = true
    }
  }

  for (let i = 0; i < props.length; i++) {
    // static attribute
    const prop = props[i]
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const { loc, name, value } = prop
      if (name === 'ref') {
        hasRef = true
      }
      // skip :is on <component>
      if (name === 'is' && tag === 'component') {
        continue
      }
      properties.push(
        createObjectProperty(
          createSimpleExpression(
            name,
            true,
            getInnerRange(loc, 0, name.length)
          ),
          createSimpleExpression(
            value ? value.content : '',
            true,
            value ? value.loc : loc
          )
        )
      )
    } else {
      // directives
      const { name, arg, exp, loc } = prop
      const isBind = name === 'bind'
      const isOn = name === 'on'

      // skip v-slot - it is handled by its dedicated transform.
      if (name === 'slot') {
        if (!isComponent) {
          context.onError(
            createCompilerError(ErrorCodes.X_V_SLOT_MISPLACED, loc)
          )
        }
        continue
      }
      // skip v-once - it is handled by its dedicated transform.
      if (name === 'once') {
        continue
      }
      // skip :is on <component>
      if (isBind && tag === 'component' && isBindKey(arg, 'is')) {
        continue
      }
      // skip v-on in SSR compilation
      if (isOn && ssr) {
        continue
      }

      // special case for v-bind and v-on with no argument
      if (!arg && (isBind || isOn)) {
        hasDynamicKeys = true
        if (exp) {
          if (properties.length) {
            mergeArgs.push(
              createObjectExpression(dedupeProperties(properties), elementLoc)
            )
            properties = []
          }
          if (isBind) {
            mergeArgs.push(exp)
          } else {
            // v-on="obj" -> toHandlers(obj)
            mergeArgs.push({
              type: NodeTypes.JS_CALL_EXPRESSION,
              loc,
              callee: context.helper(TO_HANDLERS),
              arguments: [exp]
            })
          }
        } else {
          context.onError(
            createCompilerError(
              isBind
                ? ErrorCodes.X_V_BIND_NO_EXPRESSION
                : ErrorCodes.X_V_ON_NO_EXPRESSION,
              loc
            )
          )
        }
        continue
      }

      const directiveTransform = context.directiveTransforms[name]
      if (directiveTransform) {
        // has built-in directive transform.
        const { props, needRuntime } = directiveTransform(prop, node, context)
        !ssr && props.forEach(analyzePatchFlag)
        properties.push(...props)
        if (needRuntime) {
          runtimeDirectives.push(prop)
          if (isSymbol(needRuntime)) {
            directiveImportMap.set(prop, needRuntime)
          }
        }
      } else {
        // no built-in transform, this is a user custom directive.
        runtimeDirectives.push(prop)
      }
    }
  }

  let propsExpression: PropsExpression | undefined = undefined

  // has v-bind="object" or v-on="object", wrap with mergeProps
  if (mergeArgs.length) {
    if (properties.length) {
      mergeArgs.push(
        createObjectExpression(dedupeProperties(properties), elementLoc)
      )
    }
    if (mergeArgs.length > 1) {
      propsExpression = createCallExpression(
        context.helper(MERGE_PROPS),
        mergeArgs,
        elementLoc
      )
    } else {
      // single v-bind with nothing else - no need for a mergeProps call
      propsExpression = mergeArgs[0]
    }
  } else if (properties.length) {
    propsExpression = createObjectExpression(
      dedupeProperties(properties),
      elementLoc
    )
  }

  // patchFlag analysis
  if (hasDynamicKeys) {
    patchFlag |= PatchFlags.FULL_PROPS
  } else {
    if (hasClassBinding) {
      patchFlag |= PatchFlags.CLASS
    }
    if (hasStyleBinding) {
      patchFlag |= PatchFlags.STYLE
    }
    if (dynamicPropNames.length) {
      patchFlag |= PatchFlags.PROPS
    }
  }
  if (patchFlag === 0 && (hasRef || runtimeDirectives.length > 0)) {
    patchFlag |= PatchFlags.NEED_PATCH
  }

  return {
    props: propsExpression,
    directives: runtimeDirectives,
    patchFlag,
    dynamicPropNames
  }
}

// Dedupe props in an object literal.
// Literal duplicated attributes would have been warned during the parse phase,
// however, it's possible to encounter duplicated `onXXX` handlers with different
// modifiers. We also need to merge static and dynamic class / style attributes.
// - onXXX handlers / style: merge into array
// - class: merge into single expression with concatenation
function dedupeProperties(properties: Property[]): Property[] {
  const knownProps: Map<string, Property> = new Map()
  const deduped: Property[] = []
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i]
    // dynamic keys are always allowed
    if (prop.key.type === NodeTypes.COMPOUND_EXPRESSION || !prop.key.isStatic) {
      deduped.push(prop)
      continue
    }
    const name = prop.key.content
    const existing = knownProps.get(name)
    if (existing) {
      if (name === 'style' || name === 'class' || name.startsWith('on')) {
        mergeAsArray(existing, prop)
      }
      // unexpected duplicate, should have emitted error during parse
    } else {
      knownProps.set(name, prop)
      deduped.push(prop)
    }
  }
  return deduped
}

function mergeAsArray(existing: Property, incoming: Property) {
  if (existing.value.type === NodeTypes.JS_ARRAY_EXPRESSION) {
    existing.value.elements.push(incoming.value)
  } else {
    existing.value = createArrayExpression(
      [existing.value, incoming.value],
      existing.loc
    )
  }
}

function buildDirectiveArgs(
  dir: DirectiveNode,
  context: TransformContext
): ArrayExpression {
  const dirArgs: ArrayExpression['elements'] = []
  const runtime = directiveImportMap.get(dir)
  if (runtime) {
    context.helper(runtime)
    dirArgs.push(context.helperString(runtime))
  } else {
    // inject statement for resolving directive
    context.helper(RESOLVE_DIRECTIVE)
    context.directives.add(dir.name)
    dirArgs.push(toValidAssetId(dir.name, `directive`))
  }
  const { loc } = dir
  if (dir.exp) dirArgs.push(dir.exp)
  if (dir.arg) {
    if (!dir.exp) {
      dirArgs.push(`void 0`)
    }
    dirArgs.push(dir.arg)
  }
  if (Object.keys(dir.modifiers).length) {
    if (!dir.arg) {
      if (!dir.exp) {
        dirArgs.push(`void 0`)
      }
      dirArgs.push(`void 0`)
    }
    const trueExpression = createSimpleExpression(`true`, false, loc)
    dirArgs.push(
      createObjectExpression(
        dir.modifiers.map(modifier =>
          createObjectProperty(modifier, trueExpression)
        ),
        loc
      )
    )
  }
  return createArrayExpression(dirArgs, dir.loc)
}

function stringifyDynamicPropNames(props: string[]): string {
  let propsNamesString = `[`
  for (let i = 0, l = props.length; i < l; i++) {
    propsNamesString += JSON.stringify(props[i])
    if (i < l - 1) propsNamesString += ', '
  }
  return propsNamesString + `]`
}
