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
  Property
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
  SUSPENSE
} from '../runtimeHelpers'
import { getInnerRange, isVSlot, toValidAssetId, findProp } from '../utils'
import { buildSlots } from './vSlot'
import { isStaticNode } from './hoistStatic'

// some directive transforms (e.g. v-model) may return a symbol for runtime
// import, which should be used instead of a resolveDirective call.
const directiveImportMap = new WeakMap<DirectiveNode, symbol>()

// generate a JavaScript AST for this element's codegen
export const transformElement: NodeTransform = (node, context) => {
  if (
    node.type !== NodeTypes.ELEMENT ||
    // handled by transformSlotOutlet
    node.tagType === ElementTypes.SLOT ||
    // <template v-if/v-for> should have already been replaced
    // <templte v-slot> is handled by buildSlots
    (node.tagType === ElementTypes.TEMPLATE && node.props.some(isVSlot))
  ) {
    return
  }
  // perform the work on exit, after all child expressions have been
  // processed and merged.
  return () => {
    const isComponent = node.tagType === ElementTypes.COMPONENT
    let hasProps = node.props.length > 0
    let patchFlag: number = 0
    let runtimeDirectives: DirectiveNode[] | undefined
    let dynamicPropNames: string[] | undefined
    let dynamicComponent: string | CallExpression | undefined

    // handle dynamic component
    const isProp = findProp(node, 'is')
    if (node.tag === 'component') {
      if (isProp) {
        // static <component is="foo" />
        if (isProp.type === NodeTypes.ATTRIBUTE) {
          const tag = isProp.value && isProp.value.content
          if (tag) {
            context.helper(RESOLVE_COMPONENT)
            context.components.add(tag)
            dynamicComponent = toValidAssetId(tag, `component`)
          }
        }
        // dynamic <component :is="asdf" />
        else if (isProp.exp) {
          dynamicComponent = createCallExpression(
            context.helper(RESOLVE_DYNAMIC_COMPONENT),
            [isProp.exp]
          )
        }
      }
    }

    if (isComponent && !dynamicComponent) {
      context.helper(RESOLVE_COMPONENT)
      context.components.add(node.tag)
    }

    const args: CallExpression['arguments'] = [
      dynamicComponent
        ? dynamicComponent
        : isComponent
          ? toValidAssetId(node.tag, `component`)
          : node.tagType === ElementTypes.PORTAL
            ? context.helper(PORTAL)
            : node.tagType === ElementTypes.SUSPENSE
              ? context.helper(SUSPENSE)
              : `"${node.tag}"`
    ]
    // props
    if (hasProps) {
      const propsBuildResult = buildProps(
        node,
        context,
        // skip reserved "is" prop <component is>
        node.props.filter(p => p !== isProp)
      )
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
      if (isComponent) {
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
        args.push(
          `[${dynamicPropNames.map(n => JSON.stringify(n)).join(`, `)}]`
        )
      }
    }

    const { loc } = node
    const vnode = createCallExpression(context.helper(CREATE_VNODE), args, loc)

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

export type PropsExpression = ObjectExpression | CallExpression | ExpressionNode

export function buildProps(
  node: ElementNode,
  context: TransformContext,
  props: ElementNode['props'] = node.props
): {
  props: PropsExpression | undefined
  directives: DirectiveNode[]
  patchFlag: number
  dynamicPropNames: string[]
} {
  const elementLoc = node.loc
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

      // skip v-slot - it is handled by its dedicated transform.
      if (name === 'slot') {
        if (!isComponent) {
          context.onError(
            createCompilerError(ErrorCodes.X_V_SLOT_MISPLACED, loc)
          )
        }
        continue
      }

      // special case for v-bind and v-on with no argument
      const isBind = name === 'bind'
      const isOn = name === 'on'
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
        props.forEach(analyzePatchFlag)
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
  const knownProps: Record<string, Property> = {}
  const deduped: Property[] = []
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i]
    // dynamic keys are always allowed
    if (prop.key.type === NodeTypes.COMPOUND_EXPRESSION || !prop.key.isStatic) {
      deduped.push(prop)
      continue
    }
    const name = prop.key.content
    const existing = knownProps[name]
    if (existing) {
      if (
        name === 'style' ||
        name === 'class' ||
        name.startsWith('on') ||
        name.startsWith('vnode')
      ) {
        mergeAsArray(existing, prop)
      }
      // unexpected duplicate, should have emitted error during parse
    } else {
      knownProps[name] = prop
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
    dirArgs.push(
      createObjectExpression(
        dir.modifiers.map(modifier =>
          createObjectProperty(
            modifier,
            createSimpleExpression(`true`, false, loc)
          )
        ),
        loc
      )
    )
  }
  return createArrayExpression(dirArgs, dir.loc)
}
