import {
  type ArrayExpression,
  type AttributeNode,
  type CallExpression,
  type DirectiveNode,
  ElementTypes,
  ErrorCodes,
  type ExpressionNode,
  type InterpolationNode,
  type JSChildNode,
  MERGE_PROPS,
  type NodeTransform,
  NodeTypes,
  type PlainElementNode,
  type PropsExpression,
  type TemplateLiteral,
  type TextNode,
  type TransformContext,
  buildDirectiveArgs,
  buildProps,
  createArrayExpression,
  createAssignmentExpression,
  createCallExpression,
  createCompilerError,
  createCompoundExpression,
  createConditionalExpression,
  createInterpolation,
  createSequenceExpression,
  createSimpleExpression,
  createTemplateLiteral,
  findDir,
  hasDynamicKeyVBind,
  isStaticArgOf,
  isStaticExp,
} from '@vue/compiler-dom'
import {
  NO,
  escapeHtml,
  isBooleanAttr,
  isBuiltInDirective,
  isSSRSafeAttrName,
  propsToAttrMap,
} from '@vue/shared'
import { SSRErrorCodes, createSSRCompilerError } from '../errors'
import {
  SSR_GET_DIRECTIVE_PROPS,
  SSR_GET_DYNAMIC_MODEL_PROPS,
  SSR_INCLUDE_BOOLEAN_ATTR,
  SSR_INTERPOLATE,
  SSR_RENDER_ATTR,
  SSR_RENDER_ATTRS,
  SSR_RENDER_CLASS,
  SSR_RENDER_DYNAMIC_ATTR,
  SSR_RENDER_STYLE,
} from '../runtimeHelpers'
import {
  type SSRTransformContext,
  processChildren,
} from '../ssrCodegenTransform'

// for directives with children overwrite (e.g. v-html & v-text), we need to
// store the raw children so that they can be added in the 2nd pass.
const rawChildrenMap = new WeakMap<
  PlainElementNode,
  TemplateLiteral['elements'][0]
>()

export const ssrTransformElement: NodeTransform = (node, context) => {
  if (
    node.type !== NodeTypes.ELEMENT ||
    node.tagType !== ElementTypes.ELEMENT
  ) {
    return
  }

  return function ssrPostTransformElement() {
    // element
    // generate the template literal representing the open tag.
    const openTag: TemplateLiteral['elements'] = [`<${node.tag}`]
    // some tags need to be passed to runtime for special checks
    const needTagForRuntime =
      node.tag === 'textarea' || node.tag.indexOf('-') > 0

    // v-bind="obj", v-bind:[key] and custom directives can potentially
    // overwrite other static attrs and can affect final rendering result,
    // so when they are present we need to bail out to full `renderAttrs`
    const hasDynamicVBind = hasDynamicKeyVBind(node)
    const hasCustomDir = node.props.some(
      p => p.type === NodeTypes.DIRECTIVE && !isBuiltInDirective(p.name),
    )
    const needMergeProps = hasDynamicVBind || hasCustomDir
    if (needMergeProps) {
      const { props, directives } = buildProps(
        node,
        context,
        node.props,
        false /* isComponent */,
        false /* isDynamicComponent */,
        true /* ssr */,
      )
      if (props || directives.length) {
        const mergedProps = buildSSRProps(props, directives, context)
        const propsExp = createCallExpression(
          context.helper(SSR_RENDER_ATTRS),
          [mergedProps],
        )

        if (node.tag === 'textarea') {
          const existingText = node.children[0] as
            | TextNode
            | InterpolationNode
            | undefined
          // If interpolation, this is dynamic <textarea> content, potentially
          // injected by v-model and takes higher priority than v-bind value
          if (!existingText || existingText.type !== NodeTypes.INTERPOLATION) {
            // <textarea> with dynamic v-bind. We don't know if the final props
            // will contain .value, so we will have to do something special:
            // assign the merged props to a temp variable, and check whether
            // it contains value (if yes, render is as children).
            const tempId = `_temp${context.temps++}`
            propsExp.arguments = [
              createAssignmentExpression(
                createSimpleExpression(tempId, false),
                mergedProps,
              ),
            ]
            rawChildrenMap.set(
              node,
              createCallExpression(context.helper(SSR_INTERPOLATE), [
                createConditionalExpression(
                  createSimpleExpression(`"value" in ${tempId}`, false),
                  createSimpleExpression(`${tempId}.value`, false),
                  createSimpleExpression(
                    existingText ? existingText.content : ``,
                    true,
                  ),
                  false,
                ),
              ]),
            )
          }
        } else if (node.tag === 'input') {
          // <input v-bind="obj" v-model>
          // we need to determine the props to render for the dynamic v-model
          // and merge it with the v-bind expression.
          const vModel = findVModel(node)
          if (vModel) {
            // 1. save the props (san v-model) in a temp variable
            const tempId = `_temp${context.temps++}`
            const tempExp = createSimpleExpression(tempId, false)
            propsExp.arguments = [
              createSequenceExpression([
                createAssignmentExpression(tempExp, mergedProps),
                createCallExpression(context.helper(MERGE_PROPS), [
                  tempExp,
                  createCallExpression(
                    context.helper(SSR_GET_DYNAMIC_MODEL_PROPS),
                    [
                      tempExp, // existing props
                      vModel.exp!, // model
                    ],
                  ),
                ]),
              ]),
            ]
          }
        } else if (directives.length && !node.children.length) {
          // v-text directive has higher priority than the merged props
          const vText = findDir(node, 'text')
          if (!vText) {
            const tempId = `_temp${context.temps++}`
            propsExp.arguments = [
              createAssignmentExpression(
                createSimpleExpression(tempId, false),
                mergedProps,
              ),
            ]
            rawChildrenMap.set(
              node,
              createConditionalExpression(
                createSimpleExpression(`"textContent" in ${tempId}`, false),
                createCallExpression(context.helper(SSR_INTERPOLATE), [
                  createSimpleExpression(`${tempId}.textContent`, false),
                ]),
                createSimpleExpression(`${tempId}.innerHTML ?? ''`, false),
                false,
              ),
            )
          }
        }

        if (needTagForRuntime) {
          propsExp.arguments.push(`"${node.tag}"`)
        }

        openTag.push(propsExp)
      }
    }

    // book keeping static/dynamic class merging.
    let dynamicClassBinding: CallExpression | undefined = undefined
    let staticClassBinding: string | undefined = undefined
    // all style bindings are converted to dynamic by transformStyle.
    // but we need to make sure to merge them.
    let dynamicStyleBinding: CallExpression | undefined = undefined

    for (let i = 0; i < node.props.length; i++) {
      const prop = node.props[i]
      // ignore true-value/false-value on input
      if (node.tag === 'input' && isTrueFalseValue(prop)) {
        continue
      }
      // special cases with children override
      if (prop.type === NodeTypes.DIRECTIVE) {
        if (prop.name === 'html' && prop.exp) {
          rawChildrenMap.set(
            node,
            createCompoundExpression([`(`, prop.exp, `) ?? ''`]),
          )
        } else if (prop.name === 'text' && prop.exp) {
          node.children = [createInterpolation(prop.exp, prop.loc)]
        } else if (prop.name === 'slot') {
          context.onError(
            createCompilerError(ErrorCodes.X_V_SLOT_MISPLACED, prop.loc),
          )
        } else if (isTextareaWithValue(node, prop) && prop.exp) {
          if (!needMergeProps) {
            node.children = [createInterpolation(prop.exp, prop.loc)]
          }
        } else if (!needMergeProps && prop.name !== 'on') {
          // Directive transforms.
          const directiveTransform = context.directiveTransforms[prop.name]
          if (directiveTransform) {
            const { props, ssrTagParts } = directiveTransform(
              prop,
              node,
              context,
            )
            if (ssrTagParts) {
              openTag.push(...ssrTagParts)
            }
            for (let j = 0; j < props.length; j++) {
              const { key, value } = props[j]
              if (isStaticExp(key)) {
                let attrName = key.content
                // static key attr
                if (attrName === 'key' || attrName === 'ref') {
                  continue
                }
                if (attrName === 'class') {
                  openTag.push(
                    ` class="`,
                    (dynamicClassBinding = createCallExpression(
                      context.helper(SSR_RENDER_CLASS),
                      [value],
                    )),
                    `"`,
                  )
                } else if (attrName === 'style') {
                  if (dynamicStyleBinding) {
                    // already has style binding, merge into it.
                    mergeCall(dynamicStyleBinding, value)
                  } else {
                    openTag.push(
                      ` style="`,
                      (dynamicStyleBinding = createCallExpression(
                        context.helper(SSR_RENDER_STYLE),
                        [value],
                      )),
                      `"`,
                    )
                  }
                } else {
                  attrName =
                    node.tag.indexOf('-') > 0
                      ? attrName // preserve raw name on custom elements
                      : propsToAttrMap[attrName] || attrName.toLowerCase()
                  if (isBooleanAttr(attrName)) {
                    openTag.push(
                      createConditionalExpression(
                        createCallExpression(
                          context.helper(SSR_INCLUDE_BOOLEAN_ATTR),
                          [value],
                        ),
                        createSimpleExpression(' ' + attrName, true),
                        createSimpleExpression('', true),
                        false /* no newline */,
                      ),
                    )
                  } else if (isSSRSafeAttrName(attrName)) {
                    openTag.push(
                      createCallExpression(context.helper(SSR_RENDER_ATTR), [
                        key,
                        value,
                      ]),
                    )
                  } else {
                    context.onError(
                      createSSRCompilerError(
                        SSRErrorCodes.X_SSR_UNSAFE_ATTR_NAME,
                        key.loc,
                      ),
                    )
                  }
                }
              } else {
                // dynamic key attr
                // this branch is only encountered for custom directive
                // transforms that returns properties with dynamic keys
                const args: CallExpression['arguments'] = [key, value]
                if (needTagForRuntime) {
                  args.push(`"${node.tag}"`)
                }
                openTag.push(
                  createCallExpression(
                    context.helper(SSR_RENDER_DYNAMIC_ATTR),
                    args,
                  ),
                )
              }
            }
          }
        }
      } else {
        // special case: value on <textarea>
        const name = prop.name
        if (node.tag === 'textarea' && name === 'value' && prop.value) {
          rawChildrenMap.set(node, escapeHtml(prop.value.content))
        } else if (!needMergeProps) {
          if (name === 'key' || name === 'ref') {
            continue
          }
          // static prop
          if (name === 'class' && prop.value) {
            staticClassBinding = JSON.stringify(prop.value.content)
          }
          openTag.push(
            ` ${prop.name}` +
              (prop.value ? `="${escapeHtml(prop.value.content)}"` : ``),
          )
        }
      }
    }

    // handle co-existence of dynamic + static class bindings
    if (dynamicClassBinding && staticClassBinding) {
      mergeCall(dynamicClassBinding, staticClassBinding)
      removeStaticBinding(openTag, 'class')
    }

    if (context.scopeId) {
      openTag.push(` ${context.scopeId}`)
    }

    node.ssrCodegenNode = createTemplateLiteral(openTag)
  }
}

export function buildSSRProps(
  props: PropsExpression | undefined,
  directives: DirectiveNode[],
  context: TransformContext,
): JSChildNode {
  let mergePropsArgs: JSChildNode[] = []
  if (props) {
    if (props.type === NodeTypes.JS_CALL_EXPRESSION) {
      // already a mergeProps call
      mergePropsArgs = props.arguments as JSChildNode[]
    } else {
      mergePropsArgs.push(props)
    }
  }
  if (directives.length) {
    for (const dir of directives) {
      mergePropsArgs.push(
        createCallExpression(context.helper(SSR_GET_DIRECTIVE_PROPS), [
          `_ctx`,
          ...buildDirectiveArgs(dir, context).elements,
        ] as JSChildNode[]),
      )
    }
  }

  return mergePropsArgs.length > 1
    ? createCallExpression(context.helper(MERGE_PROPS), mergePropsArgs)
    : mergePropsArgs[0]
}

function isTrueFalseValue(prop: DirectiveNode | AttributeNode) {
  if (prop.type === NodeTypes.DIRECTIVE) {
    return (
      prop.name === 'bind' &&
      prop.arg &&
      isStaticExp(prop.arg) &&
      (prop.arg.content === 'true-value' || prop.arg.content === 'false-value')
    )
  } else {
    return prop.name === 'true-value' || prop.name === 'false-value'
  }
}

function isTextareaWithValue(
  node: PlainElementNode,
  prop: DirectiveNode,
): boolean {
  return !!(
    node.tag === 'textarea' &&
    prop.name === 'bind' &&
    isStaticArgOf(prop.arg, 'value')
  )
}

function mergeCall(call: CallExpression, arg: string | JSChildNode) {
  const existing = call.arguments[0] as ExpressionNode | ArrayExpression
  if (existing.type === NodeTypes.JS_ARRAY_EXPRESSION) {
    existing.elements.push(arg)
  } else {
    call.arguments[0] = createArrayExpression([existing, arg])
  }
}

function removeStaticBinding(
  tag: TemplateLiteral['elements'],
  binding: string,
) {
  const regExp = new RegExp(`^ ${binding}=".+"$`)

  const i = tag.findIndex(e => typeof e === 'string' && regExp.test(e))

  if (i > -1) {
    tag.splice(i, 1)
  }
}

function findVModel(node: PlainElementNode): DirectiveNode | undefined {
  return node.props.find(
    p => p.type === NodeTypes.DIRECTIVE && p.name === 'model' && p.exp,
  ) as DirectiveNode | undefined
}

export function ssrProcessElement(
  node: PlainElementNode,
  context: SSRTransformContext,
): void {
  const isVoidTag = context.options.isVoidTag || NO
  const elementsToAdd = node.ssrCodegenNode!.elements
  for (let j = 0; j < elementsToAdd.length; j++) {
    context.pushStringPart(elementsToAdd[j])
  }

  // Handle slot scopeId
  if (context.withSlotScopeId) {
    context.pushStringPart(createSimpleExpression(`_scopeId`, false))
  }

  // close open tag
  context.pushStringPart(`>`)

  const rawChildren = rawChildrenMap.get(node)
  if (rawChildren) {
    context.pushStringPart(rawChildren)
  } else if (node.children.length) {
    processChildren(node, context)
  }

  if (!isVoidTag(node.tag)) {
    // push closing tag
    context.pushStringPart(`</${node.tag}>`)
  }
}
