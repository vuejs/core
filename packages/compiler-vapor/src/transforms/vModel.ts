import {
  BindingTypes,
  DOMErrorCodes,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  createCompilerError,
  createDOMCompilerError,
  createSimpleExpression,
  findDir,
  findProp,
  hasDynamicKeyVBind,
  isMemberExpression,
  isStaticArgOf,
} from '@vue/compiler-dom'
import type { DirectiveTransform } from '../transform'
import { type DirectiveIRNode, IRNodeTypes } from '../ir'

export const transformVModel: DirectiveTransform = (dir, node, context) => {
  const { exp, arg } = dir
  if (!exp) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_MODEL_NO_EXPRESSION, dir.loc),
    )
    return
  }

  // we assume v-model directives are always parsed
  // (not artificially created by a transform)
  const rawExp = exp.loc.source

  // in SFC <script setup> inline mode, the exp may have been transformed into
  // _unref(exp)
  const bindingType = context.options.bindingMetadata[rawExp]

  // check props
  if (
    bindingType === BindingTypes.PROPS ||
    bindingType === BindingTypes.PROPS_ALIASED
  ) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_MODEL_ON_PROPS, exp.loc),
    )
    return
  }

  const expString = exp.content
  const maybeRef =
    context.options.inline &&
    (bindingType === BindingTypes.SETUP_LET ||
      bindingType === BindingTypes.SETUP_REF ||
      bindingType === BindingTypes.SETUP_MAYBE_REF)
  if (
    !expString.trim() ||
    (!isMemberExpression(exp, context.options) && !maybeRef)
  ) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_MODEL_MALFORMED_EXPRESSION, exp.loc),
    )
    return
  }

  const isComponent = node.tagType === ElementTypes.COMPONENT
  if (isComponent) {
    return {
      key: arg ? arg : createSimpleExpression('modelValue', true),
      value: exp,
      model: true,
      modelModifiers: dir.modifiers.map(m => m.content),
    }
  }

  if (dir.arg)
    context.options.onError(
      createDOMCompilerError(
        DOMErrorCodes.X_V_MODEL_ARG_ON_ELEMENT,
        dir.arg.loc,
      ),
    )
  const { tag } = node
  const isCustomElement = context.options.isCustomElement(tag)
  let modelType: DirectiveIRNode['modelType'] | undefined = 'text'
  // TODO let runtimeDirective: VaporHelper | undefined = 'vModelText'
  if (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    isCustomElement
  ) {
    if (tag === 'input' || isCustomElement) {
      const type = findProp(node, 'type')
      if (type) {
        if (type.type === NodeTypes.DIRECTIVE) {
          // :type="foo"
          modelType = 'dynamic'
        } else if (type.value) {
          switch (type.value.content) {
            case 'radio':
              modelType = 'radio'
              break
            case 'checkbox':
              modelType = 'checkbox'
              break
            case 'file':
              modelType = undefined
              context.options.onError(
                createDOMCompilerError(
                  DOMErrorCodes.X_V_MODEL_ON_FILE_INPUT_ELEMENT,
                  dir.loc,
                ),
              )
              break
            default:
              // text type
              __DEV__ && checkDuplicatedValue()
              break
          }
        }
      } else if (hasDynamicKeyVBind(node)) {
        // element has bindings with dynamic keys, which can possibly contain
        // "type".
        modelType = 'dynamic'
      } else {
        // text type
        __DEV__ && checkDuplicatedValue()
      }
    } else if (tag === 'select') {
      modelType = 'select'
    } else {
      // textarea
      __DEV__ && checkDuplicatedValue()
    }
  } else {
    context.options.onError(
      createDOMCompilerError(
        DOMErrorCodes.X_V_MODEL_ON_INVALID_ELEMENT,
        dir.loc,
      ),
    )
  }

  if (modelType)
    context.registerOperation({
      type: IRNodeTypes.DIRECTIVE,
      element: context.reference(),
      dir,
      name: 'model',
      modelType,
      builtin: true,
    })

  function checkDuplicatedValue() {
    const value = findDir(node, 'bind')
    if (value && isStaticArgOf(value.arg, 'value')) {
      context.options.onError(
        createDOMCompilerError(
          DOMErrorCodes.X_V_MODEL_UNNECESSARY_VALUE,
          value.loc,
        ),
      )
    }
  }
}
