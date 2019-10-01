import {
  ElementNode,
  ObjectExpression,
  createObjectExpression,
  NodeTypes,
  createObjectProperty,
  createSimpleExpression,
  createFunctionExpression,
  DirectiveNode,
  ElementTypes,
  ExpressionNode,
  Property,
  TemplateChildNode,
  SourceLocation
} from '../ast'
import { TransformContext, NodeTransform } from '../transform'
import { createCompilerError, ErrorCodes } from '../errors'
import { isString } from '@vue/shared'

const isVSlot = (p: ElementNode['props'][0]): p is DirectiveNode =>
  p.type === NodeTypes.DIRECTIVE && p.name === 'slot'

// A NodeTransform that tracks scope identifiers for scoped slots so that they
// don't get prefixed by transformExpression. This transform is only applied
// in non-browser builds with { prefixIdentifiers: true }
export const trackSlotScopes: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    (node.tagType === ElementTypes.COMPONENT ||
      node.tagType === ElementTypes.TEMPLATE)
  ) {
    const vSlot = node.props.find(isVSlot)
    if (vSlot && vSlot.exp) {
      context.addIdentifiers(vSlot.exp)
      return () => {
        context.removeIdentifiers(vSlot.exp!)
      }
    }
  }
}

// Instead of being a DirectiveTransform, v-slot processing is called during
// transformElement to build the slots object for a component.
export function buildSlots(
  { props, children, loc }: ElementNode,
  context: TransformContext
): {
  slots: ObjectExpression
  hasDynamicSlotName: boolean
} {
  const slots: Property[] = []
  let hasDynamicSlotName = false

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
  let extraneousChild: TemplateChildNode | undefined = undefined
  const seenSlotNames = new Set<string>()
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    let slotDir
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.TEMPLATE &&
      (slotDir = child.props.find(isVSlot))
    ) {
      hasTemplateSlots = true
      const { children, loc: nodeLoc } = child
      const { arg: slotName, exp: slotProps, loc: dirLoc } = slotDir
      if (explicitDefaultSlot) {
        // already has on-component default slot - this is incorrect usage.
        context.onError(
          createCompilerError(ErrorCodes.X_MIXED_SLOT_USAGE, dirLoc)
        )
        break
      } else {
        if (
          !slotName ||
          (slotName.type === NodeTypes.SIMPLE_EXPRESSION && slotName.isStatic)
        ) {
          // check duplicate slot names
          const name = slotName ? slotName.content : `default`
          if (seenSlotNames.has(name)) {
            context.onError(
              createCompilerError(ErrorCodes.X_DUPLICATE_SLOT_NAMES, dirLoc)
            )
            continue
          }
          seenSlotNames.add(name)
        } else {
          hasDynamicSlotName = true
        }
        slots.push(
          buildSlot(slotName || `default`, slotProps, children, nodeLoc)
        )
      }
    } else if (!extraneousChild) {
      extraneousChild = child
    }
  }

  if (hasTemplateSlots && extraneousChild) {
    context.onError(
      createCompilerError(
        ErrorCodes.X_EXTRANEOUS_NON_SLOT_CHILDREN,
        extraneousChild.loc
      )
    )
  }

  if (!explicitDefaultSlot && !hasTemplateSlots) {
    // implicit default slot.
    slots.push(buildSlot(`default`, undefined, children, loc))
  }

  return {
    slots: createObjectExpression(slots, loc),
    hasDynamicSlotName
  }
}

function buildSlot(
  name: string | ExpressionNode,
  slotProps: ExpressionNode | undefined,
  children: TemplateChildNode[],
  loc: SourceLocation
): Property {
  return createObjectProperty(
    isString(name) ? createSimpleExpression(name, true, loc) : name,
    createFunctionExpression(
      slotProps,
      children,
      children.length ? children[0].loc : loc
    )
  )
}
