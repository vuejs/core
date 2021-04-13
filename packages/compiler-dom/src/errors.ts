import {
  SourceLocation,
  CompilerError,
  createCompilerError,
  ErrorCodes
} from '@vue/compiler-core'

export interface DOMCompilerError extends CompilerError {
  code: DOMErrorCodes
}

export function createDOMCompilerError(
  code: DOMErrorCodes,
  loc?: SourceLocation
): DOMCompilerError {
  return createCompilerError(
    code,
    loc,
    __DEV__ || !__BROWSER__ ? DOMErrorMessages : undefined
  )
}

export const enum DOMErrorCodes {
  X_V_HTML_NO_EXPRESSION = ErrorCodes.__EXTEND_POINT__,
  X_V_HTML_WITH_CHILDREN,
  X_V_TEXT_NO_EXPRESSION,
  X_V_TEXT_WITH_CHILDREN,
  X_V_MODEL_ON_INVALID_ELEMENT,
  X_V_MODEL_ARG_ON_ELEMENT,
  X_V_MODEL_ON_FILE_INPUT_ELEMENT,
  X_V_SHOW_NO_EXPRESSION,
  X_TRANSITION_INVALID_CHILDREN,
  X_IGNORED_SIDE_EFFECT_TAG,
  __EXTEND_POINT__
}

export const DOMErrorMessages: { [code: number]: string } = {
  [DOMErrorCodes.X_V_HTML_NO_EXPRESSION]: `v-html is missing expression.`,
  [DOMErrorCodes.X_V_HTML_WITH_CHILDREN]: `v-html will override element children.`,
  [DOMErrorCodes.X_V_TEXT_NO_EXPRESSION]: `v-text is missing expression.`,
  [DOMErrorCodes.X_V_TEXT_WITH_CHILDREN]: `v-text will override element children.`,
  [DOMErrorCodes.X_V_MODEL_ON_INVALID_ELEMENT]: `v-model can only be used on <input>, <textarea> and <select> elements.`,
  [DOMErrorCodes.X_V_MODEL_ARG_ON_ELEMENT]: `v-model argument is not supported on plain elements.`,
  [DOMErrorCodes.X_V_MODEL_ON_FILE_INPUT_ELEMENT]: `v-model cannot be used on file inputs since they are read-only. Use a v-on:change listener instead.`,
  [DOMErrorCodes.X_V_SHOW_NO_EXPRESSION]: `v-show is missing expression.`,
  [DOMErrorCodes.X_TRANSITION_INVALID_CHILDREN]: `<Transition> expects exactly one child element or component.`,
  [DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG]: `Tags with side effect (<script> and <style>) are ignored in client component templates.`
}
