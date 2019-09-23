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
  createObjectExpression
} from '../ast'
import { isArray } from '@vue/shared'
import { createCompilerError, ErrorCodes } from '../errors'
import {
  CREATE_VNODE,
  APPLY_DIRECTIVES,
  RESOLVE_DIRECTIVE,
  RESOLVE_COMPONENT
} from '../runtimeConstants'

const toValidId = (str: string): string => str.replace(/[^\w]/g, '')

// generate a JavaScript AST for this element's codegen
export const prepareElementForCodegen: NodeTransform = (node, context) => {
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
    } else if (node.tagType === ElementTypes.TEMPLATE) {
      // do nothing
    }
  }
}

function buildProps(
  { loc, props }: ElementNode,
  context: TransformContext
): {
  props: ObjectExpression | CallExpression
  directives: DirectiveNode[]
} {
  let properties: ObjectExpression['properties'] = []
  const mergeArgs: Array<ObjectExpression | ExpressionNode> = []
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
      // special case for v-bind with no argument
      if (prop.name === 'bind' && !prop.arg) {
        if (prop.exp) {
          if (properties.length) {
            mergeArgs.push(createObjectExpression(properties, loc))
            properties = []
          }
          mergeArgs.push(prop.exp)
        } else {
          context.onError(
            createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, prop.loc)
          )
        }
        continue
      }

      const directiveTransform = context.directiveTransforms[prop.name]
      if (directiveTransform) {
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

  let ret: ObjectExpression | CallExpression

  // has v-bind="object", wrap with mergeProps
  if (mergeArgs.length) {
    if (properties.length) {
      mergeArgs.push(createObjectExpression(properties, loc))
    }
    if (mergeArgs.length > 1) {
      ret = createCallExpression(`mergeProps`, mergeArgs, loc)
    } else {
      // single v-bind with nothing else - no need for a mergeProps call
      ret = createObjectExpression(properties, loc)
    }
  } else {
    ret = createObjectExpression(properties, loc)
  }

  return {
    props: ret,
    directives: runtimeDirectives
  }
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
