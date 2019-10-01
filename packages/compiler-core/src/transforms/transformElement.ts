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
  SourceLocation
} from '../ast'
import { isArray, PatchFlags } from '@vue/shared'
import { createCompilerError, ErrorCodes } from '../errors'
import {
  CREATE_VNODE,
  APPLY_DIRECTIVES,
  RESOLVE_DIRECTIVE,
  RESOLVE_COMPONENT,
  MERGE_PROPS,
  TO_HANDLERS
} from '../runtimeConstants'
import { getInnerRange } from '../utils'
import { buildSlots } from './vSlot'

const toValidId = (str: string): string => str.replace(/[^\w]/g, '')

// generate a JavaScript AST for this element's codegen
export const transformElement: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    if (
      node.tagType === ElementTypes.ELEMENT ||
      node.tagType === ElementTypes.COMPONENT
    ) {
      const isComponent = node.tagType === ElementTypes.COMPONENT
      let hasProps = node.props.length > 0
      const hasChildren = node.children.length > 0
      let patchFlag: number = 0
      let runtimeDirectives: DirectiveNode[] | undefined
      let dynamicPropNames: string[] | undefined
      let componentIdentifier: string | undefined

      if (isComponent) {
        componentIdentifier = `_component_${toValidId(node.tag)}`
        context.statements.add(
          `const ${componentIdentifier} = ${context.helper(
            RESOLVE_COMPONENT
          )}(${JSON.stringify(node.tag)})`
        )
      }

      const args: CallExpression['arguments'] = [
        isComponent ? componentIdentifier! : `"${node.tag}"`
      ]
      // props
      if (hasProps) {
        const propsBuildResult = buildProps(
          node.props,
          node.loc,
          context,
          isComponent
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
      if (hasChildren) {
        if (!hasProps) {
          args.push(`null`)
        }
        if (isComponent) {
          const { slots, hasDynamicSlotName } = buildSlots(node, context)
          args.push(slots)
          if (hasDynamicSlotName) {
            patchFlag |= PatchFlags.DYNAMIC_SLOTS
          }
        } else {
          // only v-for fragments will have keyed/unkeyed flags
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
        args.push(String(patchFlag))
        if (dynamicPropNames && dynamicPropNames.length) {
          args.push(
            `[${dynamicPropNames.map(n => JSON.stringify(n)).join(`, `)}]`
          )
        }
      }

      const { loc } = node
      const vnode = createCallExpression(
        context.helper(CREATE_VNODE),
        args,
        loc
      )

      if (runtimeDirectives && runtimeDirectives.length) {
        node.codegenNode = createCallExpression(
          context.helper(APPLY_DIRECTIVES),
          [
            vnode,
            createArrayExpression(
              runtimeDirectives.map(dir => {
                return createDirectiveArgs(dir, context)
              }),
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
}

type PropsExpression = ObjectExpression | CallExpression | ExpressionNode

export function buildProps(
  props: ElementNode['props'],
  elementLoc: SourceLocation,
  context: TransformContext,
  isComponent: boolean = false
): {
  props: PropsExpression | undefined
  directives: DirectiveNode[]
  patchFlag: number
  dynamicPropNames: string[]
} {
  let isStatic = true
  let properties: ObjectExpression['properties'] = []
  const mergeArgs: PropsExpression[] = []
  const runtimeDirectives: DirectiveNode[] = []

  // patchFlag analysis
  let patchFlag = 0
  const dynamicPropNames: string[] = []
  let hasDynammicKeys = false
  let hasClassBinding = false
  let hasStyleBinding = false
  let hasRef = false

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
          ),
          loc
        )
      )
    } else {
      // directives
      isStatic = false
      const { name, arg, exp, loc } = prop

      // skip v-slot - it is handled by its dedicated transform.
      if (name === 'slot') {
        if (!isComponent) {
          context.onError(
            createCompilerError(ErrorCodes.X_MISPLACED_V_SLOT, loc)
          )
        }
        continue
      }

      // special case for v-bind and v-on with no argument
      const isBind = name === 'bind'
      if (!arg && (isBind || name === 'on')) {
        hasDynammicKeys = true
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

      // patchFlag analysis
      if (isBind && arg) {
        if (arg.type === NodeTypes.SIMPLE_EXPRESSION && arg.isStatic) {
          const name = arg.content
          if (name === 'ref') {
            hasRef = true
          } else if (name === 'class') {
            hasClassBinding = true
          } else if (name === 'style') {
            hasStyleBinding = true
          } else {
            dynamicPropNames.push(name)
          }
        } else {
          hasDynammicKeys = true
        }
      }

      const directiveTransform = context.directiveTransforms[name]
      if (directiveTransform) {
        // has built-in directive transform.
        const { props, needRuntime } = directiveTransform(prop, context)
        if (isArray(props)) {
          properties.push(...props)
        } else {
          properties.push(props)
        }
        if (needRuntime) {
          runtimeDirectives.push(prop)
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

  // hoist the object if it's fully static
  if (isStatic && propsExpression) {
    propsExpression = context.hoist(propsExpression)
  }

  // determine the flags to add
  if (hasDynammicKeys) {
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
      if (name.startsWith('on') || name === 'style' || name === 'class') {
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

function createDirectiveArgs(
  dir: DirectiveNode,
  context: TransformContext
): ArrayExpression {
  // inject statement for resolving directive
  const dirIdentifier = `_directive_${toValidId(dir.name)}`
  context.statements.add(
    `const ${dirIdentifier} = ${context.helper(
      RESOLVE_DIRECTIVE
    )}(${JSON.stringify(dir.name)})`
  )
  const dirArgs: ArrayExpression['elements'] = [dirIdentifier]
  const { loc } = dir
  if (dir.exp) dirArgs.push(dir.exp)
  if (dir.arg) dirArgs.push(dir.arg)
  if (Object.keys(dir.modifiers).length) {
    dirArgs.push(
      createObjectExpression(
        dir.modifiers.map(modifier =>
          createObjectProperty(
            createSimpleExpression(modifier, true, loc),
            createSimpleExpression(`true`, false, loc),
            loc
          )
        ),
        loc
      )
    )
  }
  return createArrayExpression(dirArgs, dir.loc)
}
