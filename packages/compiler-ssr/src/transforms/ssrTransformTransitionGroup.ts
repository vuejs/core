import {
  type AttributeNode,
  type ComponentNode,
  type DirectiveNode,
  type JSChildNode,
  NodeTypes,
  type TransformContext,
  buildProps,
  createCallExpression,
  findProp,
} from '@vue/compiler-dom'
import { hasOwn } from '@vue/shared'
import {
  SSR_FILTER_TRANSITION_PROPS,
  SSR_RENDER_ATTRS,
} from '../runtimeHelpers'
import {
  type SSRTransformContext,
  processChildren,
} from '../ssrCodegenTransform'
import { buildSSRProps } from './ssrTransformElement'

// Import transition props validators from the runtime
const TransitionPropsValidators = (() => {
  // Re-create the TransitionPropsValidators structure that's used at runtime
  // This mirrors the logic from @vue/runtime-dom/src/components/Transition.ts
  const BaseTransitionPropsValidators = {
    mode: String,
    appear: Boolean,
    persisted: Boolean,
    onBeforeEnter: [Function, Array],
    onEnter: [Function, Array],
    onAfterEnter: [Function, Array],
    onEnterCancelled: [Function, Array],
    onBeforeLeave: [Function, Array],
    onLeave: [Function, Array],
    onAfterLeave: [Function, Array],
    onLeaveCancelled: [Function, Array],
    onBeforeAppear: [Function, Array],
    onAppear: [Function, Array],
    onAfterAppear: [Function, Array],
    onAppearCancelled: [Function, Array],
  }

  const DOMTransitionPropsValidators = {
    name: String,
    type: String,
    css: { type: Boolean, default: true },
    duration: [String, Number, Object],
    enterFromClass: String,
    enterActiveClass: String,
    enterToClass: String,
    appearFromClass: String,
    appearActiveClass: String,
    appearToClass: String,
    leaveFromClass: String,
    leaveActiveClass: String,
    leaveToClass: String,
  }

  return {
    ...BaseTransitionPropsValidators,
    ...DOMTransitionPropsValidators,
  }
})()

// Helper function to convert kebab-case to camelCase
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

const wipMap = new WeakMap<ComponentNode, WIPEntry>()

interface WIPEntry {
  tag: AttributeNode | DirectiveNode
  propsExp: string | JSChildNode | null
  scopeId: string | null
  sawObjectVBind: boolean
}

// phase 1: build props
export function ssrTransformTransitionGroup(
  node: ComponentNode,
  context: TransformContext,
) {
  return (): void => {
    const tag = findProp(node, 'tag')
    if (tag) {
      // Track whether we saw object v-bind (v-bind without argument)
      let sawObjectVBind = false

      // Filter out all transition-related private props when processing TransitionGroup attributes
      const otherProps = node.props.filter(p => {
        // Exclude tag (already handled separately)
        if (p === tag) {
          return false
        }

        // Exclude all transition-related attributes and TransitionGroup-specific attributes
        // This logic mirrors the runtime TransitionGroup attribute filtering logic
        if (p.type === NodeTypes.ATTRIBUTE) {
          // Static attributes: check attribute name (supports kebab-case to camelCase conversion)
          const propName = p.name
          const camelCaseName = kebabToCamel(propName)
          const shouldFilter =
            hasOwn(TransitionPropsValidators, propName) ||
            hasOwn(TransitionPropsValidators, camelCaseName) ||
            propName === 'moveClass' ||
            propName === 'move-class'
          return !shouldFilter
        } else if (p.type === NodeTypes.DIRECTIVE && p.name === 'bind') {
          // Dynamic attributes: check bound attribute name
          if (
            p.arg &&
            p.arg.type === NodeTypes.SIMPLE_EXPRESSION &&
            p.arg.isStatic
          ) {
            const argName = p.arg.content
            const camelCaseArgName = kebabToCamel(argName)
            const shouldFilter =
              hasOwn(TransitionPropsValidators, argName) ||
              hasOwn(TransitionPropsValidators, camelCaseArgName) ||
              argName === 'moveClass' ||
              argName === 'move-class'
            return !shouldFilter
          } else if (
            !p.arg &&
            p.exp &&
            p.exp.type === NodeTypes.SIMPLE_EXPRESSION &&
            p.exp.content !== '_attrs'
          ) {
            // Object v-bind (v-bind="props") - only count user-written bindings
            // Exclude compiler-generated _attrs binding
            sawObjectVBind = true
            return true // Keep the object v-bind directive
          }
        }

        return true
      })
      const { props, directives } = buildProps(
        node,
        context,
        otherProps,
        true /* isComponent */,
        false /* isDynamicComponent */,
        true /* ssr (skip event listeners) */,
      )
      let propsExp = null
      if (props || directives.length) {
        const ssrPropsExp = buildSSRProps(props, directives, context)
        propsExp = createCallExpression(context.helper(SSR_RENDER_ATTRS), [
          sawObjectVBind
            ? createCallExpression(
                context.helper(SSR_FILTER_TRANSITION_PROPS),
                [ssrPropsExp],
              )
            : ssrPropsExp,
        ])
      }
      wipMap.set(node, {
        tag,
        propsExp,
        scopeId: context.scopeId || null,
        sawObjectVBind,
      })
    }
  }
}

// phase 2: process children
export function ssrProcessTransitionGroup(
  node: ComponentNode,
  context: SSRTransformContext,
): void {
  const entry = wipMap.get(node)
  if (entry) {
    const { tag, propsExp, scopeId } = entry
    if (tag.type === NodeTypes.DIRECTIVE) {
      // dynamic :tag
      context.pushStringPart(`<`)
      context.pushStringPart(tag.exp!)
      if (propsExp) {
        context.pushStringPart(propsExp)
      }
      if (scopeId) {
        context.pushStringPart(` ${scopeId}`)
      }
      context.pushStringPart(`>`)

      processChildren(
        node,
        context,
        false,
        /**
         * TransitionGroup has the special runtime behavior of flattening and
         * concatenating all children into a single fragment (in order for them to
         * be patched using the same key map) so we need to account for that here
         * by disabling nested fragment wrappers from being generated.
         */
        true,
        /**
         * TransitionGroup filters out comment children at runtime and thus
         * doesn't expect comments to be present during hydration. We need to
         * account for that by disabling the empty comment that is otherwise
         * rendered for a falsy v-if that has no v-else specified. (#6715)
         */
        true,
      )
      context.pushStringPart(`</`)
      context.pushStringPart(tag.exp!)
      context.pushStringPart(`>`)
    } else {
      // static tag
      context.pushStringPart(`<${tag.value!.content}`)
      if (propsExp) {
        context.pushStringPart(propsExp)
      }
      if (scopeId) {
        context.pushStringPart(` ${scopeId}`)
      }
      context.pushStringPart(`>`)
      processChildren(node, context, false, true, true)
      context.pushStringPart(`</${tag.value!.content}>`)
    }
  } else {
    // fragment
    processChildren(node, context, true, true, true)
  }
}
