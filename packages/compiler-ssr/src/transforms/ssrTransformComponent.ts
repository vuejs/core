import {
  CREATE_VNODE,
  type CallExpression,
  type CompilerOptions,
  type ComponentNode,
  DOMDirectiveTransforms,
  DOMNodeTransforms,
  type DirectiveNode,
  ElementTypes,
  type ExpressionNode,
  type FunctionExpression,
  type JSChildNode,
  Namespaces,
  type NodeTransform,
  NodeTypes,
  RESOLVE_DYNAMIC_COMPONENT,
  type ReturnStatement,
  type RootNode,
  SUSPENSE,
  type SlotFnBuilder,
  TELEPORT,
  TRANSITION,
  TRANSITION_GROUP,
  type TemplateChildNode,
  type TemplateNode,
  type TransformContext,
  type TransformOptions,
  buildProps,
  buildSlots,
  createCallExpression,
  createFunctionExpression,
  createIfStatement,
  createReturnStatement,
  createRoot,
  createSimpleExpression,
  createTransformContext,
  getBaseTransformPreset,
  locStub,
  resolveComponentType,
  stringifyExpression,
  traverseNode,
} from '@vue/compiler-dom'
import { SSR_RENDER_COMPONENT, SSR_RENDER_VNODE } from '../runtimeHelpers'
import {
  type SSRTransformContext,
  processChildren,
  processChildrenAsStatement,
} from '../ssrCodegenTransform'
import { ssrProcessTeleport } from './ssrTransformTeleport'
import {
  ssrProcessSuspense,
  ssrTransformSuspense,
} from './ssrTransformSuspense'
import {
  ssrProcessTransitionGroup,
  ssrTransformTransitionGroup,
} from './ssrTransformTransitionGroup'
import { extend, isArray, isObject, isPlainObject, isSymbol } from '@vue/shared'
import { buildSSRProps } from './ssrTransformElement'
import {
  ssrProcessTransition,
  ssrTransformTransition,
} from './ssrTransformTransition'

// We need to construct the slot functions in the 1st pass to ensure proper
// scope tracking, but the children of each slot cannot be processed until
// the 2nd pass, so we store the WIP slot functions in a weakMap during the 1st
// pass and complete them in the 2nd pass.
const wipMap = new WeakMap<ComponentNode, WIPSlotEntry[]>()

const WIP_SLOT = Symbol()

interface WIPSlotEntry {
  type: typeof WIP_SLOT
  fn: FunctionExpression
  children: TemplateChildNode[]
  vnodeBranch: ReturnStatement
}

const componentTypeMap = new WeakMap<
  ComponentNode,
  string | symbol | CallExpression
>()

// ssr component transform is done in two phases:
// In phase 1. we use `buildSlot` to analyze the children of the component into
// WIP slot functions (it must be done in phase 1 because `buildSlot` relies on
// the core transform context).
// In phase 2. we convert the WIP slots from phase 1 into ssr-specific codegen
// nodes.
export const ssrTransformComponent: NodeTransform = (node, context) => {
  if (
    node.type !== NodeTypes.ELEMENT ||
    node.tagType !== ElementTypes.COMPONENT
  ) {
    return
  }

  const component = resolveComponentType(node, context, true /* ssr */)
  const isDynamicComponent =
    isObject(component) && component.callee === RESOLVE_DYNAMIC_COMPONENT
  componentTypeMap.set(node, component)

  if (isSymbol(component)) {
    if (component === SUSPENSE) {
      return ssrTransformSuspense(node, context)
    } else if (component === TRANSITION_GROUP) {
      return ssrTransformTransitionGroup(node, context)
    } else if (component === TRANSITION) {
      return ssrTransformTransition(node, context)
    }
    return // other built-in components: fallthrough
  }

  // Build the fallback vnode-based branch for the component's slots.
  // We need to clone the node into a fresh copy and use the buildSlots' logic
  // to get access to the children of each slot. We then compile them with
  // a child transform pipeline using vnode-based transforms (instead of ssr-
  // based ones), and save the result branch (a ReturnStatement) in an array.
  // The branch is retrieved when processing slots again in ssr mode.
  const vnodeBranches: ReturnStatement[] = []
  const clonedNode = clone(node)

  return function ssrPostTransformComponent() {
    // Using the cloned node, build the normal VNode-based branches (for
    // fallback in case the child is render-fn based). Store them in an array
    // for later use.
    if (clonedNode.children.length) {
      buildSlots(clonedNode, context, (props, vFor, children) => {
        vnodeBranches.push(
          createVNodeSlotBranch(props, vFor, children, context),
        )
        return createFunctionExpression(undefined)
      })
    }

    let propsExp: string | JSChildNode = `null`
    if (node.props.length) {
      // note we are not passing ssr: true here because for components, v-on
      // handlers should still be passed
      const { props, directives } = buildProps(
        node,
        context,
        undefined,
        true,
        isDynamicComponent,
      )
      if (props || directives.length) {
        propsExp = buildSSRProps(props, directives, context)
      }
    }

    const wipEntries: WIPSlotEntry[] = []
    wipMap.set(node, wipEntries)

    const buildSSRSlotFn: SlotFnBuilder = (props, _vForExp, children, loc) => {
      const param0 = (props && stringifyExpression(props)) || `_`
      const fn = createFunctionExpression(
        [param0, `_push`, `_parent`, `_scopeId`],
        undefined, // no return, assign body later
        true, // newline
        true, // isSlot
        loc,
      )
      wipEntries.push({
        type: WIP_SLOT,
        fn,
        children,
        // also collect the corresponding vnode branch built earlier
        vnodeBranch: vnodeBranches[wipEntries.length],
      })
      return fn
    }

    const slots = node.children.length
      ? buildSlots(node, context, buildSSRSlotFn).slots
      : `null`

    if (typeof component !== 'string') {
      // dynamic component that resolved to a `resolveDynamicComponent` call
      // expression - since the resolved result may be a plain element (string)
      // or a VNode, handle it with `renderVNode`.
      node.ssrCodegenNode = createCallExpression(
        context.helper(SSR_RENDER_VNODE),
        [
          `_push`,
          createCallExpression(context.helper(CREATE_VNODE), [
            component,
            propsExp,
            slots,
          ]),
          `_parent`,
        ],
      )
    } else {
      node.ssrCodegenNode = createCallExpression(
        context.helper(SSR_RENDER_COMPONENT),
        [component, propsExp, slots, `_parent`],
      )
    }
  }
}

export function ssrProcessComponent(
  node: ComponentNode,
  context: SSRTransformContext,
  parent: { children: TemplateChildNode[] },
): void {
  const component = componentTypeMap.get(node)!
  if (!node.ssrCodegenNode) {
    // this is a built-in component that fell-through.
    if (component === TELEPORT) {
      return ssrProcessTeleport(node, context)
    } else if (component === SUSPENSE) {
      return ssrProcessSuspense(node, context)
    } else if (component === TRANSITION_GROUP) {
      return ssrProcessTransitionGroup(node, context)
    } else {
      // real fall-through: Transition / KeepAlive
      // just render its children.
      // #5352: if is at root level of a slot, push an empty string.
      // this does not affect the final output, but avoids all-comment slot
      // content of being treated as empty by ssrRenderSlot().
      if ((parent as WIPSlotEntry).type === WIP_SLOT) {
        context.pushStringPart(``)
      }
      if (component === TRANSITION) {
        return ssrProcessTransition(node, context)
      }
      processChildren(node, context)
    }
  } else {
    // finish up slot function expressions from the 1st pass.
    const wipEntries = wipMap.get(node) || []
    for (let i = 0; i < wipEntries.length; i++) {
      const { fn, vnodeBranch } = wipEntries[i]
      // For each slot, we generate two branches: one SSR-optimized branch and
      // one normal vnode-based branch. The branches are taken based on the
      // presence of the 2nd `_push` argument (which is only present if the slot
      // is called by `_ssrRenderSlot`.
      fn.body = createIfStatement(
        createSimpleExpression(`_push`, false),
        processChildrenAsStatement(
          wipEntries[i],
          context,
          false,
          true /* withSlotScopeId */,
        ),
        vnodeBranch,
      )
    }

    // component is inside a slot, inherit slot scope Id
    if (context.withSlotScopeId) {
      node.ssrCodegenNode.arguments.push(`_scopeId`)
    }

    if (typeof component === 'string') {
      // static component
      context.pushStatement(
        createCallExpression(`_push`, [node.ssrCodegenNode]),
      )
    } else {
      // dynamic component (`resolveDynamicComponent` call)
      // the codegen node is a `renderVNode` call
      context.pushStatement(node.ssrCodegenNode)
    }
  }
}

export const rawOptionsMap: WeakMap<RootNode, CompilerOptions> = new WeakMap<
  RootNode,
  CompilerOptions
>()

const [baseNodeTransforms, baseDirectiveTransforms] =
  getBaseTransformPreset(true)
const vnodeNodeTransforms = [...baseNodeTransforms, ...DOMNodeTransforms]
const vnodeDirectiveTransforms = {
  ...baseDirectiveTransforms,
  ...DOMDirectiveTransforms,
}

function createVNodeSlotBranch(
  slotProps: ExpressionNode | undefined,
  vFor: DirectiveNode | undefined,
  children: TemplateChildNode[],
  parentContext: TransformContext,
): ReturnStatement {
  // apply a sub-transform using vnode-based transforms.
  const rawOptions = rawOptionsMap.get(parentContext.root)!

  const subOptions = {
    ...rawOptions,
    // overwrite with vnode-based transforms
    nodeTransforms: [
      ...vnodeNodeTransforms,
      ...(rawOptions.nodeTransforms || []),
    ],
    directiveTransforms: {
      ...vnodeDirectiveTransforms,
      ...(rawOptions.directiveTransforms || {}),
    },
  }

  // wrap the children with a wrapper template for proper children treatment.
  // important: provide v-slot="props" and v-for="exp" on the wrapper for
  // proper scope analysis
  const wrapperProps: TemplateNode['props'] = []
  if (slotProps) {
    wrapperProps.push({
      type: NodeTypes.DIRECTIVE,
      name: 'slot',
      exp: slotProps,
      arg: undefined,
      modifiers: [],
      loc: locStub,
    })
  }
  if (vFor) {
    wrapperProps.push(extend({}, vFor))
  }
  const wrapperNode: TemplateNode = {
    type: NodeTypes.ELEMENT,
    ns: Namespaces.HTML,
    tag: 'template',
    tagType: ElementTypes.TEMPLATE,
    props: wrapperProps,
    children,
    loc: locStub,
    codegenNode: undefined,
  }
  subTransform(wrapperNode, subOptions, parentContext)
  return createReturnStatement(children)
}

function subTransform(
  node: TemplateChildNode,
  options: TransformOptions,
  parentContext: TransformContext,
) {
  const childRoot = createRoot([node])
  const childContext = createTransformContext(childRoot, options)
  // this sub transform is for vnode fallback branch so it should be handled
  // like normal render functions
  childContext.ssr = false
  // inherit parent scope analysis state
  childContext.scopes = { ...parentContext.scopes }
  childContext.identifiers = { ...parentContext.identifiers }
  childContext.imports = parentContext.imports
  // traverse
  traverseNode(childRoot, childContext)
  // merge helpers/components/directives into parent context
  ;(['helpers', 'components', 'directives'] as const).forEach(key => {
    childContext[key].forEach((value: any, helperKey: any) => {
      if (key === 'helpers') {
        const parentCount = parentContext.helpers.get(helperKey)
        if (parentCount === undefined) {
          parentContext.helpers.set(helperKey, value)
        } else {
          parentContext.helpers.set(helperKey, value + parentCount)
        }
      } else {
        ;(parentContext[key] as any).add(value)
      }
    })
  })
  // imports/hoists are not merged because:
  // - imports are only used for asset urls and should be consistent between
  //   node/client branches
  // - hoists are not enabled for the client branch here
}

function clone(v: any): any {
  if (isArray(v)) {
    return v.map(clone)
  } else if (isPlainObject(v)) {
    const res: any = {}
    for (const key in v) {
      res[key] = clone(v[key as keyof typeof v])
    }
    return res
  } else {
    return v
  }
}
