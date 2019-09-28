import {
  ElementNode,
  ObjectExpression,
  createObjectExpression,
  NodeTypes,
  createCompoundExpression,
  createCallExpression,
  CompoundExpressionNode,
  CallExpression,
  createObjectProperty,
  createSimpleExpression,
  createFunctionExpression,
  DirectiveNode,
  ElementTypes,
  ExpressionNode,
  Property,
  ChildNode,
  SourceLocation
} from '../ast'
import { TransformContext } from '../transform'
import { buildProps } from './transformElement'
import { createCompilerError, ErrorCodes } from '../errors'
import { isSimpleIdentifier } from '../utils'
import { RENDER_SLOT } from '../runtimeConstants'
import { isString } from '@vue/shared'

const isVSlot = (p: ElementNode['props'][0]): p is DirectiveNode =>
  p.type === NodeTypes.DIRECTIVE && p.name === 'slot'

export function buildSlots(
  { props, children, loc }: ElementNode,
  context: TransformContext
): ObjectExpression {
  const slots: Property[] = []

  // 1. Check for default slot with slotProps on component itself.
  //    <Comp v-slot="{ prop }"/>
  const explicitDefaultSlot = props.find(isVSlot)
  if (explicitDefaultSlot) {
    const { arg, exp, loc } = explicitDefaultSlot
    if (arg) {
      context.onError(
        createCompilerError(ErrorCodes.X_NAMED_SLOT_ON_COMPONENT, loc)
      )
    }
    slots.push(buildSlot(`default`, exp, children, loc))
  }

  // 2. Iterate through children and check for template slots
  //    <template v-slot:foo="{ prop }">
  let hasTemplateSlots = false
  const seenSlotNames = new Set<string>()
  const nonSlotChildren: ChildNode[] = []
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.TEMPLATE
    ) {
      const { props, children, loc: nodeLoc } = child
      const slotDir = props.find(isVSlot)
      if (slotDir) {
        hasTemplateSlots = true
        const { arg: slotName, exp: slotProps, loc: dirLoc } = slotDir
        if (explicitDefaultSlot) {
          // already has on-component default slot - this is incorrect usage.
          context.onError(
            createCompilerError(ErrorCodes.X_MIXED_SLOT_USAGE, dirLoc)
          )
          break
        } else {
          // check duplicate slot names
          if (
            !slotName ||
            (slotName.type === NodeTypes.SIMPLE_EXPRESSION && slotName.isStatic)
          ) {
            const name = slotName ? slotName.content : `default`
            if (seenSlotNames.has(name)) {
              context.onError(
                createCompilerError(ErrorCodes.X_DUPLICATE_SLOT_NAMES, dirLoc)
              )
              continue
            }
            seenSlotNames.add(name)
          }
          slots.push(
            buildSlot(slotName || `default`, slotProps, children, nodeLoc)
          )
        }
      } else {
        nonSlotChildren.push(child)
      }
    } else {
      nonSlotChildren.push(child)
    }
  }

  if (hasTemplateSlots && nonSlotChildren.length) {
    context.onError(
      createCompilerError(
        ErrorCodes.X_EXTRANEOUS_NON_SLOT_CHILDREN,
        nonSlotChildren[0].loc
      )
    )
  }

  if (!explicitDefaultSlot && !hasTemplateSlots) {
    // implicit default slot.
    slots.push(buildSlot(`default`, undefined, children, loc))
  }

  return createObjectExpression(slots, loc)
}

function buildSlot(
  name: string | ExpressionNode,
  slotProps: ExpressionNode | undefined,
  children: ChildNode[],
  loc: SourceLocation
): Property {
  return createObjectProperty(
    isString(name) ? createSimpleExpression(name, true, loc) : name,
    createFunctionExpression(
      slotProps,
      children,
      children.length ? children[0].loc : loc
    ),
    loc
  )
}

export function buildSlotOutlet(node: ElementNode, context: TransformContext) {
  const { props, children, loc } = node
  const $slots = context.prefixIdentifiers ? `_ctx.$slots` : `$slots`
  let slot: string | CompoundExpressionNode = $slots + `.default`

  // check for <slot name="xxx" OR :name="xxx" />
  let nameIndex: number = -1
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    if (prop.type === NodeTypes.ATTRIBUTE) {
      if (prop.name === `name` && prop.value) {
        // static name="xxx"
        const name = prop.value.content
        const accessor = isSimpleIdentifier(name)
          ? `.${name}`
          : `[${JSON.stringify(name)}]`
        slot = `${$slots}${accessor}`
        nameIndex = i
        break
      }
    } else if (prop.name === `bind`) {
      const { arg, exp } = prop
      if (
        arg &&
        exp &&
        arg.type === NodeTypes.SIMPLE_EXPRESSION &&
        arg.isStatic &&
        arg.content === `name`
      ) {
        // dynamic :name="xxx"
        slot = createCompoundExpression(
          [
            $slots + `[`,
            ...(exp.type === NodeTypes.SIMPLE_EXPRESSION
              ? [exp]
              : exp.children),
            `]`
          ],
          loc
        )
        nameIndex = i
        break
      }
    }
  }

  const slotArgs: CallExpression['arguments'] = [slot]
  const propsWithoutName =
    nameIndex > -1
      ? props.slice(0, nameIndex).concat(props.slice(nameIndex + 1))
      : props
  const hasProps = propsWithoutName.length
  if (hasProps) {
    const { props: propsExpression, directives } = buildProps(
      propsWithoutName,
      loc,
      context
    )
    if (directives.length) {
      context.onError(
        createCompilerError(
          ErrorCodes.X_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
          directives[0].loc
        )
      )
    }
    slotArgs.push(propsExpression)
  }

  if (children.length) {
    if (!hasProps) {
      slotArgs.push(`{}`)
    }
    slotArgs.push(children)
  }

  node.codegenNode = createCallExpression(
    context.helper(RENDER_SLOT),
    slotArgs,
    loc
  )
}
