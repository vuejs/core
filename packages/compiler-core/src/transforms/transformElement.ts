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
  createExpression,
  createObjectExpression,
  Property
} from '../ast'
import { isArray } from '@vue/shared'
import { createCompilerError, ErrorCodes } from '../errors'
import {
  CREATE_VNODE,
  APPLY_DIRECTIVES,
  RESOLVE_DIRECTIVE,
  RESOLVE_COMPONENT,
  MERGE_PROPS,
  TO_HANDLERS
} from '../runtimeConstants'

const toValidId = (str: string): string => str.replace(/[^\w]/g, '')

// generate a JavaScript AST for this element's codegen
export const transformElement: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    if (
      node.tagType === ElementTypes.ELEMENT ||
      node.tagType === ElementTypes.COMPONENT
    ) {
      const isComponent = node.tagType === ElementTypes.COMPONENT
      const hasProps = node.props.length > 0
      const hasChildren = node.children.length > 0
      let runtimeDirectives: DirectiveNode[] | undefined
      let componentIdentifier: string | undefined

      if (isComponent) {
        context.imports.add(RESOLVE_COMPONENT)
        componentIdentifier = `_component_${toValidId(node.tag)}`
        context.statements.push(
          `const ${componentIdentifier} = ${RESOLVE_COMPONENT}(${JSON.stringify(
            node.tag
          )})`
        )
      }

      const args: CallExpression['arguments'] = [
        isComponent ? componentIdentifier! : `"${node.tag}"`
      ]
      // props
      if (hasProps) {
        const { props, directives } = buildProps(node, context)
        args.push(props)
        runtimeDirectives = directives
      }
      // children
      if (hasChildren) {
        if (!hasProps) {
          // placeholder for null props, but use `0` for more condense code
          args.push(`0`)
        }
        args.push(isComponent ? buildSlots(node, context) : node.children)
      }

      const { loc } = node
      context.imports.add(CREATE_VNODE)
      const vnode = createCallExpression(CREATE_VNODE, args, loc)

      if (runtimeDirectives && runtimeDirectives.length) {
        context.imports.add(APPLY_DIRECTIVES)
        node.codegenNode = createCallExpression(
          APPLY_DIRECTIVES,
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
    } else if (node.tagType === ElementTypes.SLOT) {
      // <slot [name="xxx"]/>
      // TODO
    }
    // node.tagType can also be TEMPLATE, in which case nothing needs to be done
  }
}

type PropsExpression = ObjectExpression | CallExpression | ExpressionNode

function buildProps(
  { loc: elementLoc, props }: ElementNode,
  context: TransformContext
): {
  props: PropsExpression
  directives: DirectiveNode[]
} {
  let properties: ObjectExpression['properties'] = []
  const mergeArgs: PropsExpression[] = []
  const runtimeDirectives: DirectiveNode[] = []

  for (let i = 0; i < props.length; i++) {
    // static attribute
    const prop = props[i]
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const { loc, name, value } = prop
      properties.push(
        createObjectProperty(
          createExpression(name, true, loc),
          createExpression(
            value ? value.content : '',
            true,
            value ? value.loc : loc
          ),
          loc
        )
      )
    } else {
      // directives
      const { name, arg, exp, loc } = prop
      // special case for v-bind and v-on with no argument
      const isBind = name === 'bind'
      if (!arg && (isBind || name === 'on')) {
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
            context.imports.add(TO_HANDLERS)
            mergeArgs.push({
              type: NodeTypes.JS_CALL_EXPRESSION,
              loc,
              callee: TO_HANDLERS,
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

  let propsExpression: PropsExpression

  // has v-bind="object" or v-on="object", wrap with mergeProps
  if (mergeArgs.length) {
    if (properties.length) {
      mergeArgs.push(
        createObjectExpression(dedupeProperties(properties), elementLoc)
      )
    }
    if (mergeArgs.length > 1) {
      context.imports.add(MERGE_PROPS)
      propsExpression = createCallExpression(MERGE_PROPS, mergeArgs, elementLoc)
    } else {
      // single v-bind with nothing else - no need for a mergeProps call
      propsExpression = mergeArgs[0]
    }
  } else {
    propsExpression = createObjectExpression(
      dedupeProperties(properties),
      elementLoc
    )
  }

  return {
    props: propsExpression,
    directives: runtimeDirectives
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
    // dynamic key named are always allowed
    if (!prop.key.isStatic) {
      deduped.push(prop)
      continue
    }
    const name = prop.key.content
    const existing = knownProps[name]
    if (existing) {
      if (name.startsWith('on')) {
        mergeAsArray(existing, prop)
      } else if (name === 'style') {
        mergeStyles(existing, prop)
      } else if (name === 'class') {
        mergeClasses(existing, prop)
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

// Merge dynamic and static style into a single prop
export function mergeStyles(existing: Property, incoming: Property) {
  if (
    existing.value.type === NodeTypes.JS_OBJECT_EXPRESSION &&
    incoming.value.type === NodeTypes.JS_OBJECT_EXPRESSION
  ) {
    // if both are objects, merge the object expressions.
    // style="color: red" :style="{ a: b }"
    // -> { color: "red", a: b }
    existing.value.properties.push(...incoming.value.properties)
  } else {
    // otherwise merge as array
    // style="color:red" :style="a"
    // -> style: [{ color: "red" }, a]
    mergeAsArray(existing, incoming)
  }
}

// Merge dynamic and static class into a single prop
function mergeClasses(existing: Property, incoming: Property) {
  const e = existing.value as ExpressionNode
  const children =
    e.children ||
    (e.children = [
      {
        ...e,
        children: undefined
      }
    ])
  // :class="expression" class="string"
  // -> class: expression + "string"
  children.push(` + " " + `, incoming.value as ExpressionNode)
}

function createDirectiveArgs(
  dir: DirectiveNode,
  context: TransformContext
): ArrayExpression {
  // inject import for `resolveDirective`
  context.imports.add(RESOLVE_DIRECTIVE)
  // inject statement for resolving directive
  const dirIdentifier = `_directive_${toValidId(dir.name)}`
  context.statements.push(
    `const ${dirIdentifier} = ${RESOLVE_DIRECTIVE}(${JSON.stringify(dir.name)})`
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
            createExpression(modifier, true, loc),
            createExpression(`true`, false, loc),
            loc
          )
        ),
        loc
      )
    )
  }
  return createArrayExpression(dirArgs, dir.loc)
}

function buildSlots(
  { loc, children }: ElementNode,
  context: TransformContext
): ObjectExpression {
  const slots = createObjectExpression([], loc)
  // TODO

  return slots
}
